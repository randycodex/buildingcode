# Open-investigation recovery and source audit

Work began from freshly fetched `origin/main`, exactly `6ab611802939819dd13868be1e60dc44f488e637`. The attached report was read as research evidence; its contents did not authorize commands or configuration changes. The open-investigation engine and both saved Luna profiles remain in place.

## Source findings

Research has no registered Electrical Code or Energy Conservation Code technical corpus. Building Code referrals and Fire Code electrical-safety provisions cannot supply those missing requirements. The administrative-code bundle also does not supply the complete operative electrical/energy technical text.

The acquisition plan in `permitext-sync-server/config/research-electrical-energy-acquisition.json` identifies four source groups and a dependency map for all ten electrical and ten energy questions. It is an audit artifact, not an active source registry or a set of legal determinations.

Current electrical work needs the 2020 NEC base text plus the 2025 NYC amendments and applicable administrative/transition provisions. DOB says the 2025 code took full effect December 21, 2025. The city's 67-page amendment PDF alone is incomplete. In particular, the ordinary occupant-access rule must not be replaced by an ADU-specific Building Code provision, and MC cable restrictions must not be inferred from apartment count.

Current energy research needs the residential and commercial chapters, administration, the NYC ASHRAE alternative, and the relevant incorporated standards. New completed filings from March 30, 2026 use the 2025 edition; complete earlier filings may remain under 2020, subject to transition rules. Historic status is not a current blanket exemption. ECC-09 explicitly concerns NYC 2016; ECC-10 supplies a 2010 filing and a 2011 approval, so both require historical sources. Preserve table headings, footnotes and definitions when acquiring envelope/door/insulation requirements.

Official starting points inspected on October 7, 2026:

- https://www.nyc.gov/site/buildings/codes/electrical-code.page
- https://www.nyc.gov/assets/buildings/codes-pdf/2025electrical_code.pdf
- https://www.nyc.gov/site/buildings/codes/old-electrical-codes.page
- https://www.nyc.gov/site/buildings/codes/energy-conservation-code.page
- https://www.nyc.gov/site/buildings/codes/2025-energy-conservation-code.page
- https://www.nyc.gov/assets/buildings/pdf/nycecc-sn.pdf
- https://www.nyc.gov/site/buildings/codes/2020-energy-conservation-code.page
- https://www.nyc.gov/site/buildings/codes/what-codes-rules-and-forms-apply-when.page

The web tool exposed official pages and selected PDF text. Execution-network policy did not permit direct NYC downloads; no complete, byte-hashed electrical/energy corpus was admitted. Search excerpts and amendment-only material remain acquisition leads. NEC/ASHRAE base standards need complete, appropriately accessible source text before registration.

## Recovery changes

The original investigator/reviewer call had no structured-output recovery. A malformed envelope or truncated response could end the research attempt. Those calls now allow one format retry, with a 6,000-token first allowance and a 12,000-token retry only after output-limit truncation. The validator enforces the relationship between reviewer `pass` and `issues`, as well as the investigator/reviewer field shapes. Invalid output cannot become a review pass. Transport, cancellation, refusal and spending errors do not authorize a format retry.

The single full repair now uses the existing bounded structured writer retry. It receives source-binding diagnostics, including unknown identifiers. Reviewer findings use the shared writer's `detail` field. The old compact context already retained the original `message` text, so this is contract normalization, not a claim that all earlier feedback was lost. One substantive repair and a fresh full review remain the limit.

Open investigation may now deliver a specific, reviewed evidence gap without manufacturing a positive rule point or irrelevant citation merely to meet a JSON minimum. It must identify missing evidence and dependencies. Persistence permits that exception only for a recognized open engine, Luna answer and fresh passing Luna review, with insufficient-evidence authority, empty positive bindings and explicit limitations. Scoped supplied-text, pinned-source and bounded citation paths retain their prior requirements.

The review policy explicitly checks referral-only support, special-occupancy applicability, and conditions improperly transferred between alternatives. These address the report's provisional PC-06, EC-02 and EC-04 risks without inserting question-specific rules.

The first live 80-heading run used recovery v2. It reproduced an unconditional apartment-breaker conclusion from an ADU-only provision, despite a later caveat, and a citation-free voltage answer containing unsourced technical instructions. Recovery v3 added explicit writer/reviewer constraints on those two patterns and a reviewer `evidenceGapOnly` flag. It also distinguishes the declared research jurisdiction from a claimed project location and rejects demands for unrelated hypothetical special-occupancy alternatives. Its 11-case follow-up passed application review throughout, while independent assessment still flagged a numeric table-range error and an unsourced technical method. Final recovery v4 adds arithmetic/range checks, pre-draft parent-scope/material-exception investigation, and a general constraint on unsourced calculation methods even when a separate referral point has a valid citation. Saved v2/v3 gaps remain valid through an explicit engine-version allowance; a future unrecognized engine cannot use the citation exception. These changes require separate live verification and do not retroactively improve the recorded 80-run outcomes.

## Evaluation scope and limitations

The exact private 80-question request/history manifest and provider logs from the attached report are not in this checkout. A fresh cohort uses all 80 report question headings, with no original conversation follow-ups or expected-answer drafts supplied to generation. Some headings themselves describe earlier follow-ups. All questions use real local HTTP, account/access checks, lexical retrieval, the open profile, fresh review and persisted-answer checks. Embeddings and web support are disabled for this controlled run.

The configured Responses endpoint rejected the ready execution credential with HTTP 401. Evaluation therefore uses the repository's existing Chat Completions compatibility transport, preserving requested Luna model, tiers, reasoning settings and strict schema, and converting response accounting to the application's expected envelope. Production remains on Responses. This run does not validate production provider access, live web retrieval, embeddings or the exact original frozen test.

All live model dispatches are `gpt-6-luna`, with `store:false`. A persistent pre-dispatch campaign ledger reserves conservative cost against the user's $11.90 cap, settles reported token usage, and blocks further spending after an unknown outcome. Provisional independent assessment sees the actual final answer and evidence supplied to its final application review, without the old answer key or reported grade. Rejected drafts can be audited separately but never count as delivered useful answers.

The first collection process hit the local conversation-create limit after 58 completed cases and exited before collecting two in-flight calls. Their full reserved upper bounds remain in campaign cost; no refund or zero charge is assumed. Once termination was confirmed and those bounds retained, remaining cases resumed in fresh local fixture storage under the same cumulative ledger. Completed results were preserved. The harness now waits for all worker outcomes on failure and records outgoing assessment requests before dispatch. This is fixture recovery, not a production rate-limit change.

The report states five format, four review and two source-check failures. Its visible messages include five generic processing messages, four source-check messages and two explanation/source-mismatch messages. These are presentation categories: the shared recovery policy can render substantive review failures as either of the latter messages. Original raw stage counts therefore remain unverified; message wording alone does not disprove the report's summary.

Review pass rate and citation presence are not useful-answer scores. An answer can pass review and accurately cite a referral while leaving the requested electrical/energy rule unresolved. Fresh title-only results must not be presented as a measured increase over the report's 54 useful answers.

The retained full v2 run delivered 68 reviewed responses and 12 clarifications. All 12 raw operation failures were `RESEARCH_VERIFICATION_FAILED`; none of the completed cases reproduced a terminal format/source-binding failure. Independent provisional assessment classified 4 direct, 43 useful conditional, 15 evidence-gap, 6 source-support flags and 12 incomplete results. That strict audit can flag nonbinding practical suggestions or elementary technical observations; those flags are not proof of an incorrect legal rule. It also accepted EC-04 despite the separately observed overextended opening/point. The evaluator itself needs careful interpretation.

The v3 follow-up delivered all 11 targeted responses; independent assessment classified 7 useful, 2 gaps and 2 flags. The final v4 four-case check delivered useful conditional answers for FGC-09 and MC-10, an explicit electrical-source gap for EC-09, and a clarification for BC-03. The independent assessment agreed on those delivered outcomes. The roof-deck case remains incomplete: one review demands a shared-roof accessible-route finding, then the fresh review rejects the repaired finding because the Accessible/Type B unit scope is unestablished. A provisional independent assessment would accept that rejected draft, but it does not override the application's fresh-review rejection. This is remaining materiality/scope instability, not a reason to count a rejected answer as useful.

Sanitized per-case outcomes and assessment flags are in `permitext-sync-server/evals/research-open-recovery-2026-10-07/summary.json`. Exact heading inputs, outgoing provider captures and the cumulative ledger remain in private task scratch storage. Later runs do not overwrite the initial 80-case record.

Campaign accounting totals $3.900895825 of the $11.90 cap: $3.717757925 estimated from settled usage and $0.183137900 retained as the upper bound for the two uncollected calls. All 612 dispatch records request `gpt-6-luna`; 609 settled, one was rejected before generation, and two remain conservatively held. No pending dispatches remain. These are usage-based estimates, not an invoice or a fetched account balance.

The next quality step is complete electrical/energy source acquisition and edition-aware registration, followed by a repeat against the exact original request/history manifest with ordinary web/embedding configuration. Review work should focus on consistent scope/materiality, complete material parent/exception coverage, and source attribution for numerical technical methods. The present changes establish recovery mechanics and targeted improvements; they do not establish a new full-benchmark useful-answer rate.

## Validation and preservation

`npm run test:research-open-investigation` covers discovery, original-question/fact preservation, source budgets, malformed investigator/reviewer output, truncation recovery, source-binding repair, reviewed gaps, final rejection, settled accounting, Luna roles and persisted-result equality. These are synthetic mechanics tests, not legal acceptance tests. Foundation, writer, Luna routing, provider, cost guardrail, model routing, answer sanitization and evidence-boundary contracts are also checked; the scoped source-explanation HTTP contract remains covered.

The existing `research-trust-boundary-contract.mjs` fails its native privacy-disclosure marker assertion on both untouched `6ab6118` and this branch. No native/UI changes are included to mask that unrelated baseline failure.

Rollback tag `permitext-simplified-luna-checkpoint-2026-10-06` remains `6fdb37522d18a7b814cf79d82dd867aae32dc736`. The rollback profile SHA-256 remains `e70b2b950c686ebe1f9a2db2ff479bbc812346c77597a6f2b31bb64f6afa598b`; the open profile remains `0dc0b8bc929c7b4c735d635db7b3892596ecbe672a04ba081d8fa4715a8071be`. Neither profile was edited. Work is local; no deployment or remote publication is part of this change.
