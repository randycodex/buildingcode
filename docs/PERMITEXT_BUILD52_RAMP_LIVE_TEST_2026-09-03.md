# Build 52 controlled Production ramp test — September 3, 2026

## Exact authorization

The owner replied “yes” to the immediately preceding explicit authorization request for one Production Research turn from TestFlight build **52**, against release **`1873ba6453bf6f3d1f076e34fa2ddfb96b9cf40c`**, asking exactly:

> What are the requirements for designing an accessible ramp under the 2022 NYC Building Code?

Maximum cumulative API spend: **$1**. This authorizes one submission, not an additional retry, follow-up, batch, cap change, or price/allowance change. The earlier build-51 authorization remains consumed and separate.

## Pre-submission checks

- Production `/release` still reports the exact authorized SHA and deployment `permitext-sync-jmyt7jolr-randycodexs-projects-b72fc111.vercel.app`.
- Build `1.0 (52)` installation and basic physical-iPhone continuity were observed in the [release record](./PERMITEXT_RESEARCH_RECOVERY_RELEASE_2026-09-03.md).
- The test uses a fresh, unassigned conversation with the exact general code question and no Project facts. The existing failed conversation is not retried or removed.
- Existing Production spending controls remain unchanged. The released pre-dispatch cumulative guard includes all internal provider phases and preserves reservations when usage is unknown; no missing usage is treated as zero.

Status: **one completed and saved Production answer; delivery/reopen/allowance checks pass; answer completeness remains open**. The owner corrected the draft after Mirroring keyboard input proved unreliable. The exact authorized text and Unassigned/no-Project-facts state were visually verified before tapping Send once at approximately 23:22:46 UTC. The single-submission authorization is consumed; no additional attempt is authorized.

## Correlated Production result

Read-only Vercel logs were restricted to the released deployment and the test time window. No account identifiers, Project facts, or private conversation contents are retained here.

- Deployment: `dpl_CRPoXH4RrtrKVn3MLBgrrcLFdsr9`; exact serving source `1873ba6453bf6f3d1f076e34fa2ddfb96b9cf40c`.
- Request: `POST /research/conversations/message`, HTTP **200**.
- Request ID: `iad1::fkc8k-1788477768308-99398a4e860a`.
- Request timestamp: `2026-09-03T23:22:48.308Z`; final route observation: `2026-09-03T23:23:23.209Z`.
- Operation ID: `7acb5eb5-97b8-494d-84d0-78ebf91fdc9d`; status `completed`, `charged: true`, no failure code.
- Total route duration: **34,884 ms**; operation accounting duration: **34,747 ms**. This is server timing, not a precisely instrumented tap-to-paint measurement.
- Answer phase: Terra, **24,341 ms**, one provider attempt. Verification phase: Luna, **5,672 ms**, one provider attempt. No escalation or revision; no verification issue types reported.
- Two provider requests, **zero pending provider reservations**, 28,627 total reported tokens.
- Estimated token/API cost: **$0.057825**. Conservative provider-cost accounting: **$0.114176**. Both are below the authorized **$1** maximum. These are usage-based accounting figures, not independently reconciled OpenAI invoiced spend.
- Web support: not requested, not searched, zero attempts. The package contained 16 evidence sections/passages.

The deployment-scoped live log follower was stopped after inspection. No deployment, configuration, spending cap, subscription, or price was changed.

## Physical-iPhone result

- A cited answer with a direct dimensional summary and an Item/Requirement table appeared in the app.
- Returning to Research history showed the exact question as a saved Unassigned conversation with two messages. Reopening restored the answer without a new submission.
- Account still displayed active Lifetime Pro and Synced. Included turns changed from the previously observed **99** to **98**, consistent with one completed turn and the operation's `charged: true` result. No purchase occurred.
- The answer was left open on the physical phone. No retry, follow-up, second question, or feedback report was submitted.
- This was a fresh Unassigned question, unlike the original failed Project-context request. Its success and timing do not establish acceptance of the original 29-fact context or a general latency percentile.

## Answer completeness and no-cost diagnosis

The visible answer supplies useful baseline dimensions and a table, but explicitly says the supplied evidence lacks ICC A117.1 details and some Building Code landing, handrail, guard, and egress provisions. This does **not** yet meet the owner's complete practical design-answer expectation. The full answer's legal correctness has not been independently certified by this test; an internal verification pass is not an official determination.

A read-only local reproduction used the exact question, the shipped 2022 bundle/search index, `discoverRelevantEvidence`, and `assembleResearchEvidence`, with **zero provider calls**. It returned ten discovered sections and six cross-references, plus `cross-reference-limit` and `retrieval-completeness` limitations:

- Discovered: BC 1101.2, 1012.2, 1012.1, 1012.10, 1012.7.1, 1012.8, 1012.6, 1012.5.1, 1012.3, 1012.4.
- Added references: BC 1012.5, 1012.7, 1012.9, 1012.10.1, 1012.6.1, 1012.6.2.
- BC 1012.6.3, 1012.6.4, 1014.2, and 1014.6 exist with nonempty enacted text in that same local corpus, but were not included. This proves a bounded local retrieval gap, not the exact complete membership of the separately stored Production package.
- `research-evidence-assembly.mjs` currently permits ten discovered sources and six cross-references. Its direct-reference priority does not explicitly preserve all dimensional dependencies needed by the ramp question.
- The existing full-corpus ramp regression uses the shorter question “what are the requirements for designing a ramp?” and does not cover this exact wording. It asserts two landing children for that shorter query, which did not protect this variant.

Next no-cost correction: retain the exact-question regression, prioritize the governing dimensional dependencies within reviewed cost bounds, preserve scoping/exceptions, and separately identify edition-correct referenced-standard coverage. Do not fill missing authoritative text from model memory, weaken verification, raise spending limits, or request another paid test before the corrected offline gates pass.
