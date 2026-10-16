# Prepared Research retrieval

Local implementation on top of 54db5c787. Not deployed by this change.

## Behavior

- The deployment build creates private, compressed passage indexes for the same five authorized current corpora. All 54,298 passages, canonical identities, posting lists, ranking statistics and source fields survive an exact round-trip equality check. Repeated strings are interned without shortening any text. Total compressed size: 16,808,739 bytes.
- Runtime checks corpus/edition, catalog digest, index implementation digest, public asset revision, deployment commit, artifact checksum, fingerprint and canonical record identities. Present stale/corrupt artifacts fail closed. Missing current-corpus artifacts fail in hosted execution. Local development and unprepared historical/opt-in corpora can use the existing builder.
- A bounded 256-entry public-source body cache coalesces repeated reads across retrieval queries. Keys include corpus, source version, edition, identity and title. Failures are evicted. Callers receive separate clones, so annotations cannot affect later reads. Project facts and generated answers are never cached here.
- Operation logs now separate corpus loading, semantic resource loading, semantic search, discovery, source resolution and assembly timings. These are nested intervals, and sibling queries overlap: do not add all of them to end-to-end retrieval time. Investigation model time remains separately reported inside retrieval.
- The semantic asset verification script always builds fresh indexes, so it cannot validate old vectors against an old cached artifact. The build still checks the current source inventory before packaging.

Luna routing, reasoning effort, tiers, evidence budgets, investigation rounds, writer/reviewer instructions, repairs, canonical citation checks, spend reservations and fresh full-answer review remain unchanged. Prompt metadata was not pruned in this patch; exact evidence preservation is the acceptance boundary.

## Verification

- New prepared-index tests: exact round-trip and ranking equality; rejection of wrong corpus, edition, catalog, implementation, asset revision, commit, checksum, fingerprint and passage count.
- New source-cache tests: concurrent coalescing, edition/corpus isolation, mutation isolation, eviction and failed-read retry.
- Offline matched benchmark: freshly built versus prepared index, same three questions, no network. Whole evidence packets match after excluding only observation timestamps and elapsed time. Source text, identities, conditions, tables, selection and ordering match.
- Local cold resource load measured 5,852 ms fresh versus 1,765 ms prepared (separate Node processes on the same Mac). This is not hosted latency.
- Research context/speed and latency HTTP suites passed, including rejected-answer exclusion, bounded repair and fresh review. Compact passage ranking, semantic artifact, indexed passage containment, dependency recovery, and verification-report contracts passed.
- Two additional older contracts fail identically on baseline 54db5c787 and this change: corpus-partition-cache expects `semantic_production_spend_integration_required` but receives `semantic_key_missing`; hosted-semantic-http assumes every non-review response uses low effort, but a repair uses medium. These assertions were not weakened.

Run the focused offline checks with `npm run test:research-prepared-retrieval`. This builds local ignored artifacts and runs the matched evidence comparison. `node scripts/verify-prepared-research-assets.mjs` independently verifies all 31 authorized semantic corpus combinations.

## Live replay

Isolated local HTTP server, actual provider requests, same saved 43-fact fixture and questions used in the earlier replay:

1. “how do you determine the use group for this site?”
2. “for this specific project, which use groups apply to it?”
3. “no no, this is a new project -”

No production conversations were changed. Every research answer below ultimately passed fresh review. The correction retained the project and used zero provider requests. Paid runs used the existing $12 authorization and pre-dispatch ledger; no unknown outcomes remain.

| Run | Initial answer | Follow-up | Correction | Repairs |
| --- | ---: | ---: | ---: | --- |
| Index-only exploratory | 92.75 s | 50.36 s | 0.17 s | Both answers |
| Prepared indexes + body reuse, fresh worker | 33.47 s | 21.17 s | 0.18 s | None |
| Confirmation, fresh worker | 94.85 s | 25.48 s | 0.19 s | Initial answer |
| Confirmation, same warm worker/new chat | 28.02 s | 27.57 s | 0.34 s | None |

The initial repaired confirmation spent 17.33 s retrieving, 7.55 s drafting, 12.72 s across reviews and 55.56 s repairing. The warm initial answer spent 12.45 s retrieving, 8.37 s drafting and 5.39 s reviewing. This confirms useful retrieval savings, not consistent sub-30-second answers. Some offline checks overlapped the confirmation campaign on this local machine, so these samples are not production percentiles or controlled hosted A/B measurements.

Three deliberately invalid answers were separately submitted to the unchanged reviewer: invented proposed-building facts, invented citation/source IDs, and claimed detachment/deletion of project facts. All three were rejected. The reviewer additionally flagged a table-notation wording nuance in one control. Neither successful reviews nor this small sample establishes general legal accuracy.

Estimated new provider cost: $0.5140. Shared campaign ledger total including a conservative $0.101491 allowance for prior production acceptance: $1.3109 of $12. These are estimates, not invoice-confirmed charges.

Artifacts remain outside Git under `/tmp/permitext-context-replay-20261015/`: prepared-1, prepared-final-1, prepared-confirmation, prepared-negative and ledger.json. Private project facts, provider request payloads, credentials and generated index binaries are not committed.

## Remaining bottleneck

Sub-30 seconds is demonstrated on the warm questions and several follow-ups, but is not reliable. Correctly rejected drafts still invoke expensive repair. The next independently evaluated improvement should address avoidable draft errors (existing versus proposed facts, source attribution and table notation), retaining the same review and fresh post-repair checks. Do not remove those checks to meet a timing target.
