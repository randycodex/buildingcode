# Research failure recovery — September 3, 2026

Status: local implementation complete; server checks, 163 native unit tests, and the rendered Simulator failure/reopen regression pass. Production configuration verification and release approval remain open. Not deployed.

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
- After retaining the envelope regression, the complete `npm run test:research-chat` group, provider-client and web-attribution contracts, and new helper syntax check passed again with provider credentials/paid-evaluation switches removed. Runtime implementation is unchanged from local repair commit `baceb4a62a475c45d1a54dad011e75e944d79941`.
- Focused final contracts: attribution/revision, hard cost caps (including concurrent isolation), provider retry dispatch, durable messages, turn idempotency, trust boundary, spend-control acceptance, economics persistence, and ramp retrieval passed with no paid calls.
- iOS unit suite: 163/163 passed, including failure serialization, backward-compatible cache decode, same-ID retry state, and terminal-vs-lost-response reconciliation.
- Rendered Simulator failure/reopen regression: passed on iOS 26.5 in 35.407 seconds. The test submitted the isolated local failure fixture, reopened the conversation through Research history, and found the exact verification failure rather than the generic interruption message. The question and same-request retry remained visible. [Retained screen](./evidence/research-recovery-2026-09-03/reopened-verification-failure.png) was visually inspected: no clipped error text; all Project/usage content is synthetic. This does not prove physical-device or live-provider behavior.
- No-provider ramp request-envelope contract: passed using the shipped corpus and the actual answer-request prompt/schema builders. With the versioned standard-price fixture and a $0.50 cap, the base Terra answer bound is $0.288220 and the Luna web-support bound is $0.289275. An unreconciled duplicate web request and a Terra web request are blocked. Synthetic settled web usage (18,000 input / 700 output tokens) allows the base answer with a combined conservative bound of $0.328480. This is a reconciliation regression, not a prediction of real usage. The un-settled combined bound is $0.577495, so a full-turn fit must not be inferred from the individual checks. Project facts, prior chat, returned web claims, evidence analysis, verifier, and revision are outside this fixture.

Tests use mocks/local fixtures and do not call a paid provider. Physical-iPhone acceptance and a new live Research result remain separate release gates. The full native suite ran with the installed Xcode-beta selected per command, not a machine-wide developer-directory change. The storage guard refused cleanup in the isolated worktree; no cleanup was performed or bypassed.

### Simulator reproduction

Earlier attempts hit the XCTest 128-character identifier limit (fixed by a label predicate), a Clerk startup assertion, and an iOS 27 accessibility startup timeout. The successful run uses an empty **build-time, local-test-only** Clerk key so an early test launch cannot initialize the placeholder authentication configuration. Production authentication is unchanged. No Simulator reset or erase was needed.

From the isolated worktree, with the existing Xcode lock acquired and no other owned test running:

```sh
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer \
PATH=/Applications/Xcode-beta.app/Contents/Developer/usr/bin:$PATH \
xcodebuild test \
  -project 'NYC CC APP/NYC CC APP.xcodeproj' \
  -scheme permitextPhysicalStress \
  -destination 'platform=iOS Simulator,id=C9635051-D686-4415-99AA-9DA90CC9DC59' \
  -derivedDataPath /Users/randy/Library/Developer/Xcode/DerivedData/PermitextShared \
  -parallel-testing-enabled NO -parallel-testing-worker-count 1 -maximum-parallel-testing-workers 1 \
  CODE_SIGNING_ALLOWED=NO CLERK_PUBLISHABLE_KEY='' \
  -only-testing:permitextPhysicalStressUITests/NativeReaderPhysicalStressUITests/testResearchVerificationFailureRemainsVisibleAfterReopeningConversation
```

Result: `Test-permitextPhysicalStress-2026.09.03_18-27-58--0400.xcresult` in the shared DerivedData test logs. Full command log: `/private/tmp/permitext-research-recovery-empty-clerk-ui.log`. These local diagnostic paths may expire; the synthetic screenshot is retained in this repository.

### Production pricing boundary

The September 3 read-only Vercel audit found the Research models, pricing, and caps stored as **sensitive** environment variables. The list/decryption request and the individual-variable read returned metadata without usable values. Missing values are not zero, and the public health/configuration-ready flag does not prove correct prices or request fit. No environment values were changed. Do not repeat a paid request to discover the configuration.

The official standard short-context rates checked September 3 are Luna $0.20 input / $0.02 cached input / $1.20 output and Terra $2.00 / $0.20 / $12.00 per million tokens. The guard separately preserves the long-context/cache-write and web-tool allowances. The offline fixture uses these rates; it is not evidence that Production already has them. Model/routing settings must match the configured rate families. A fresh authorization to write the intended non-secret configuration, or owner verification of the live values, is required to close this boundary. Keep current spending limits unchanged; do not infer authority to change model routing or limits from a pricing inspection.

Repeat the no-cost envelope check with `node tests/research-ramp-design-retrieval-contract.mjs` in `permitext-sync-server`, without provider credentials or paid-evaluation flags.

## Release prerequisites

1. Review the final local commit and retained passing no-cost checks, including the rendered failure/reopen regression.
2. Close the hidden Production pricing/model configuration boundary and verify the full request envelope under the existing cap. The base offline preflight above is complete but is not whole-turn acceptance. Do not automatically raise caps if an envelope does not fit.
3. Obtain approval before push/deployment or a replacement TestFlight upload.
4. Obtain a separate exact live-turn authorization only after the release is bound to its source SHA. Do not rerun the failed build-51 request automatically.

## Official billing references

- [Responses API web search](https://developers.openai.com/api/docs/guides/tools-web-search): bounded built-in tool calls and a 128k search context window; returned-content limits are not arbitrary numeric token caps.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing): web tool fees are separate from search-content token charges; GPT-5.6 has long-context and cache-write rates. Configured rates must be verified before release.
- [Image input tokenization](https://developers.openai.com/api/docs/guides/images-vision): the API rejects images above 30,000 patches; GPT-5.6 uses a 1.2 multiplier. The conservative image bound is 36,000 input tokens per image, not base64 byte length.
