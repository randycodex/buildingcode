# Project Research investigation — September 30, 2026

The reported transparency conversation exposed missing applicability evidence and repeated answer repairs, rather than a need for another model switch. The configuration remains GPT-6 Luna low for writing and targeted revisions, GPT-6 Luna medium for verification, with Fast requested for both.

## Production evidence before the change

Runtime logs from release `6c3b2fd2e01a` recorded the two turns matching the screenshot timings:

| Turn | Total time | Provider calls | Review attempts | Reported provider cost |
| --- | ---: | ---: | ---: | ---: |
| Initial question | 61.517 s | 6 | 3 | $0.030487 |
| Follow-up | 53.970 s | 4 | 2 | $0.023201 |

The first turn recorded fact/evidence confusion and missed material conclusions; the follow-up recorded a missed material conclusion. Provider generation, review, and repair accounted for nearly all elapsed time. These logs do not contain the full successful draft/review payloads, so they establish the repair count and timing rather than every semantic cause.

The code supplied §§32-30, 32-321, 37-31, 37-311 and 37-34 but omitted §32-301's frontage definitions, §32-302's exceptions, and relevant §12-10 definitions. The initial question also matched a yes/no presentation rule, while the writer received conflicting completeness instructions. Existing NYC Planning inventory fields lacked an explicit existing-property scope in the shared fact projection. Ground-floor use statements were not independently retained as durable active-topic facts.

## Changes

- Follow bounded, edition-matched transparency dependencies before drafting, including complete relevant definition entries. Review sources do not become mandatory prose, and retrieval does not establish a property's legal classification.
- Keep narrow measurement follow-ups focused. Do not expand into unrelated opportunistic references after the reviewed transparency package.
- Mark imported existing-building and mapped tax-lot records with their subject scope, and retain explicitly stated ground-floor uses separately from building-wide legal classifications.
- Use concise requirements, fact-update, and governing-reference presentation. Apply definitions to supplied facts before asking for missing observable information. Follow-up questions are optional.
- Keep verification, exact source bindings, targeted repair, and the final recheck. Do not return unverified legal claims or rewrite approved claims after verification.
- Record preparation/retrieval timing, source section references, and fact counts without logging project addresses or fact content.

Existing web paths centrally inherit the workspace project for New Chat, Reader, Saved, and evidence discovery. History remains scoped by project; project moves reset active context. These safeguards were checked, not replaced.

## Validation

Final candidate validation completed October 1, 2026. Deployment identity is verified separately from these local results. Paid acceptance uses isolated accounts and local storage, the real corpus and pipeline, and the existing shared API spending ledger. It does not create production conversations.

The historical decision-fact diagnostic still has its previously known $0.24 cumulative reservation assertion failure; its old guidance also exceeds that assertion with the current builder. This change does not raise that diagnostic budget or claim a full-suite pass.


## Final candidate acceptance

The final isolated real-provider run used the same deployed model roles and real corpus, after five diagnostic iterations exposed scope conflicts and genuine draft errors. Seven answer checks completed with substantive, independently reviewed answers; the six-turn conversation retained its project and proposed-work facts, including after the section-number detour. This is a targeted acceptance sample, not a measured general success rate.

| Question | Seconds | Review attempts |
| --- | ---: | ---: |
| Initial project transparency explanation | 36.161 | 2 |
| New building with retail and community facility | 36.746 | 2 |
| Sloping-sidewalk glazing start | 23.673 | 3 |
| Governing ZR number | 22.753 | 2 |
| Explain §141-32 in the active discussion | 22.505 | 1 |
| Return to project facts and remaining checks | 87.406 | 3 |
| Initial question repeated in a fresh conversation | 63.027 | 3 |

Median: 36.161 seconds. The broad recap and repeated initial answer remain slow. Wording and length vary; the recap is repetitive. The change does not claim Instant-like speed, uniform first-pass acceptance, or fully polished prose in every turn.

All three injected false claims were rejected: blanket exemption of community-facility space in a mixed-use building, a 20% transparency requirement, and unsupported Special Jerome Corridor district membership. Every delivered answer also passed the existing deterministic source and citation gates. These controls establish rejection of those specific errors, not universal correctness.

The final replay used private run ID `20c7f8a2-8df3-4eac-839b-758e2e78f1d5`. The session-only runner, provider payloads and shared budget ledger remain uncommitted; they are not required for application runtime. The paid harness used an isolated account/store and did not write production conversations. No model, effort, pricing, or service-tier configuration was changed.

Self-contained regression command: `npm --prefix permitext-sync-server run test:research-project-investigation`. This checks applicability retrieval, existing/proposed fact scope, contextual section explanations, all web project-entry paths/history isolation, and the complete local HTTP continuation/repair/recheck flow with provider doubles. Targeted revision, citation-boundary, source-edition, context-persistence, planner/safety, prompt-envelope/compaction, and provider-accounting checks also passed. `verify:deploy-content` and `git diff --check` passed. The historical reservation assertion above remains an explicitly separate limitation; no full-suite pass is claimed.

The writer and reviewer now share a scoped conversational contract, including a material-omission test tied to the actual claim. Short section-number follow-ups explain relevance to the active topic; explicit requests for full requirements retain their broader scope. Targeted edits preserve original whitespace boundaries before fresh verification. Failed-turn accounting now retains review issue types.
