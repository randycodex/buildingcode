# Open investigation experiment — 2026-10-06

The owner approved retaining the simplified writer and replacing much of the ordinary research process. This is an experiment, not a claim of general accuracy or equivalence to ChatGPT.

## Recovery checkpoint

`permitext-simplified-luna-checkpoint-2026-10-06` points to `6fdb37522`, which preserves the simplified writer and bounded research with native Luna role settings. Its nonsecret runtime profile is `permitext-sync-server/config/research-simplified-luna-baseline.json`.

The owner prohibits Sol unless explicitly requested. Both profiles use GPT-6 Luna: priority/Fast for initial drafts, standard for review and repair. `PERMITEXT_RESEARCH_LUNA_ONLY=1` fixes routing to Luna and rejects another generation model before dispatch. Do not restore the older hybrid production environment as part of rollback.

## New flow

`PERMITEXT_RESEARCH_ENGINE=open` enables the experiment for ordinary unpinned research. It preserves the compact writer. Before drafting, a Luna investigator inspects the question, facts and retrieved provisions and can request two rounds of up to two new searches. Queries can discover previously uncited provisions and relevant code books; historical text retains its edition and does not establish applicability merely by being retrieved. The evidence merge prioritizes newly requested passages and has source and character limits. Repeated queries are suppressed, cancellation is respected, and provider calls use the existing cumulative spending guard.

The resulting answer receives a shorter substantive review. One full repair is allowed, followed by a fresh review. Legacy zoning prerequisites, stylistic gates, repeated repair loops and automatic missing-fact insertions do not block this experimental ordinary path. Exact source/citation validation, immutable evidence, project context checks, authorization, idempotency and accounting remain in place. Explicitly pinned evidence, Code Decisions, supplied-text questions, conversation recall, practical-next-step questions and exact citation lookups retain their scoped paths. Official parcel investigation and the existing official web support tools remain available.

The experiment is still bounded: it cannot retrieve a source that is unavailable, prove an unstated project fact, or guarantee that a model will identify every needed search. A truthful unresolved answer remains possible after investigation. Failed substantive review does not publish an unsupported draft.

## Rollback

Fastest recovery: set the production `PERMITEXT_RESEARCH_ENGINE` to `bounded` and redeploy. Keep the Luna-only model/tier settings. This restores the prior research process while preserving subsequent unrelated fixes.

Exact code recovery: make a revert commit for the open-investigation implementation on `main`, or deploy the checkpoint tag with its saved baseline profile. Do not reset shared main or restore an old deployment's hybrid model configuration. Check the release identity on both `permitext.com` and `permitext-sync.vercel.app` after deployment. Existing saved answers remain intact; rollback affects new requests.

## Validation

Offline contracts cover fresh discovery, unchanged original facts/question, repeated-query limits, cancellation, source budgets, pinned/supplied scope boundaries, and Luna-only dispatch. The real HTTP test uses simulated provider outputs to exercise investigation, drafting, one repair, fresh final review, persistence and exclusion of rejected answers. These tests validate mechanics, not legal accuracy.

Real-provider evaluation artifacts and cost ledgers are kept separately under the private `20261006-luna-only` baseline and `20261006-open-investigation` pilot directories. The baseline uses the unchanged `7916eb96b` checkout with audited Luna role tiers. Pilot results must not be pooled into the frozen 80-case baseline. All spending, including the stopped mistaken hybrid run, remains under the owner's original $10 ceiling.
