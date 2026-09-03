# Research failure recovery — September 3, 2026

Status: local implementation complete; server and native unit checks pass. Rendered failure/reopen acceptance remains open because Simulator UI-test startup is unreliable. Not deployed.

## Observed attempt

The owner authorized one Production Research turn from TestFlight build 51 against `195de4f31229d785760eef570a658208f1f4e47d`, asking for accessible-ramp requirements under the 2022 NYC Building Code, with a maximum cumulative API spend of $1. No repetition or follow-up was authorized.

The September 3 request began at 21:30:44 UTC and returned HTTP 502 after 105,018 ms. Both deterministic checks reported `wrong_attribution`; the second followed one bounded revision. The server returned `RESEARCH_VERIFICATION_FAILED`. The physical iPhone instead displayed the restored-pending-request interruption message. No answer was delivered. This is a failed acceptance attempt, not a completed Research turn. No failed draft was available to reproduce the exact wording. The actual prior API cost and usage-ledger entries remain unverified; the code's failure path releases the Pro-turn reservation but is not proof of that attempt's persisted ledger outcome.

The one-submission authorization has been attempted and is not reused by this work. No paid model calls, deployment, TestFlight upload, price/allowance changes, or public-release acceptance are authorized here.

## Changes

- Attribution: distinguish a generic presentation label such as “Design guidance” from a named/external guidance claim. Preserve rejection of bulletin claims, explicit guidance attribution, source-specific web paraphrases, invalid bindings, and undisclosed unavailable sources. Revision feedback now identifies zero-based flagged point locations and matching source/claim IDs. It instructs the revision to preserve enacted rules and separate web-only clauses, not discard supported conclusions. The synthetic regression reproduces a failure class, not the unavailable live draft; live semantic success remains unproven.
- Native recovery: persist the safe failure presentation with the pending question in the existing account/conversation-scoped cache. Old cache records remain decodable. Reopening restores the actual failure; an explicit retry preserves the request ID but clears the old failure before dispatch. Completed-request reconciliation still clears stale attempts.
- Latency: skip the 0/2/4/6-second recovery polling sequence after explicit pre-commit rejection codes. Keep it for lost/unknown responses. This removes 12 seconds of unnecessary client waiting on that path; it does not prove a reduction in the observed 105-second server duration.
- Cost: block a provider request before dispatch when settled conservative cost plus pending reservations plus the new bound could exceed the cumulative per-turn cap. Missing provider usage never means zero cost. Standard-tier requests and reviewed GPT-5.6 image, web-tool, and tiered-price allowances protect the bound. An unsupported billing shape fails closed. No existing Production cap is changed.
- Observability: privacy-safe provider-phase timings and operation accounting are emitted on success and failure. No question, Project facts, draft, account identifier, or provider token is added to these logs. This makes the next authorized attempt diagnosable without needing broad database access. Estimated token cost remains distinct from the conservative bound and from invoiced spend.

## Verification

- Full server `npm run check`: passed with provider credentials/paid-evaluation switches removed.
- Server `node tests/smoke.mjs`: passed.
- Focused final contracts: attribution/revision, hard cost caps (including concurrent isolation), provider retry dispatch, durable messages, turn idempotency, trust boundary, spend-control acceptance, economics persistence, and ramp retrieval passed with no paid calls.
- iOS unit suite: 163/163 passed, including failure serialization, backward-compatible cache decode, same-ID retry state, and terminal-vs-lost-response reconciliation.
- Rendered Simulator failure/reopen regression: not passed. The iOS 26.5 run reached the composer and submitted the local failure fixture, then exposed an XCTest 128-character identifier limit; the test now uses a label predicate. Other iOS 26.5 launches crashed in Clerk startup despite the test-only disable flag. Manual launch with the explicit fixture/disable flags rendered the isolated Research screen successfully, but does not prove the failure/reopen journey. The matching iOS 27 run could not initialize UI automation: `Timed out waiting for AX loaded notification`. No Simulator reset, production-authentication change, or physical-device acceptance is inferred from these attempts.

Tests use mocks/local fixtures and do not call a paid provider. Physical-iPhone acceptance and a new live Research result remain separate release gates. The full native suite ran with the installed Xcode-beta selected per command, not a machine-wide developer-directory change. The storage guard refused cleanup in the isolated worktree; no cleanup was performed or bypassed.

## Release prerequisites

1. Review the final local commit and no-cost checks; complete the rendered failure/reopen regression in a working UI-test environment.
2. Verify Production model-specific pricing and the conservative request envelope under the existing cap; do not automatically raise caps if the envelope does not fit.
3. Obtain approval before push/deployment or a replacement TestFlight upload.
4. Obtain a separate exact live-turn authorization only after the release is bound to its source SHA. Do not rerun the failed build-51 request automatically.

## Official billing references

- [Responses API web search](https://developers.openai.com/api/docs/guides/tools-web-search): bounded built-in tool calls and a 128k search context window; returned-content limits are not arbitrary numeric token caps.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing): web tool fees are separate from search-content token charges; GPT-5.6 has long-context and cache-write rates. Configured rates must be verified before release.
- [Image input tokenization](https://developers.openai.com/api/docs/guides/images-vision): the API rejects images above 30,000 patches; GPT-5.6 uses a 1.2 multiplier. The conservative image bound is 36,000 input tokens per image, not base64 byte length.
