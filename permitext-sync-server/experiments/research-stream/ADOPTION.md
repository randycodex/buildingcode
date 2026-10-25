# Fast Research default — local integration

Implemented 2026-10-25 after explicit approval to make fast answers the Research default. This supersedes the prototype-only recommendation in RESULTS.md; that file retains the original measurements and quality failure.

## Behavior

The normal Research message endpoint defaults to one streamed Luna-low answer. Web clients consume text deltas before the durable result. Existing nonstreaming clients still receive the completed JSON envelope. The web composer offers **Fast answer** (default) and **Verified Research**; the latter sends `answerMode: "verified"` and uses the existing generation/review/repair path. No review or repair is performed by the fast path.

Existing passage-only conversation scope remains passage-only: no hidden Project facts, other Reader content, property lookup, or external sources are added. Broader legacy Research uses one existing evidence assembly and official-source routing where applicable, without the multi-round investigation/review loop. This change does not make broad or web-backed Research instant.

Fast answers retain source identities and immutable evidence snapshots, with `verification.status: "unreviewed"`, `pass: false`, and zero review attempts. The label appears above the answer and in Report output, including when optional Research metadata is hidden. Missing or unresolved citation identifiers are disclosed rather than represented as verified support. Valid citation IDs still do not establish that the interpretation is correct; the prototype's footnote failure remains relevant.

Authorization, entitlement checks, source freshness, conversation scope, request replay, spend reservations, atomic saving/usage completion, revision checks, and interrupted-request handling remain in the existing endpoint. A partial response is not committed as a completed answer. The explicit verified mode is retained on retry/reload in the web recovery record.

## Validation

Passed local checks:

- `tests/research-fast-stream.mjs`: split Unicode/SSE, completion consistency, refusal, cancellation, source identities, unreviewed Report label and complete narrative.
- `tests/research-fast-http.mjs`: normal endpoint default, text deltas before result, one generation call, saved/reopened status and evidence, replay without another call, authentication, invalid mode rejection, incomplete response not saved.
- `tests/research-provider-client-contract.mjs`: existing provider retry/accounting behavior.
- `tests/assistant-material-provider-http.mjs`: explicitly selected verified mode still executes writer and reviewer with selected-only material.
- `tests/assistant-conversation-scope-http.mjs`, `tests/saved-assistant-exact-text.mjs`: selected passage boundaries and saved evidence.
- `tests/research-progress-contract.mjs`, `tests/research-progress-answer-status-contract.mjs`: recovery and progress behavior.
- `tests/offline-shell-coherence.mjs`, `tests/report-preview-contract.mjs`: matching web shell generation and report presentation.
- Browser: normal app composer defaults to Fast answer; actual incremental transport was observed with a deterministic offline provider double; completion replaced the draft; the unreviewed label was visible; citation opened BC 101.1 in a Reader.

A live check through the integrated endpoint used one Luna call: **3,653 ms to first text; 4,064 ms to completion**. Its answer correctly named the code and BC section prefix, and persisted unreviewed status. This is one sample, slower than the fastest earlier prototype samples. It does not support a guaranteed sub-second response time. Receipt: ignored `.local/integrated-live.json`.

The original approved $5 batch now has **10 requests / $4.00 conservatively reserved**. No budget reset was performed. The offline integration/browser tests made no paid calls.

## Delivery boundary

Changes are local on `codex/research-stream-prototype`. Nothing has been pushed, merged, or deployed. Production is unchanged. The web shell version is `20261025-fast-research-v1363` so a future deployment can advertise the updated client coherently. Native JSON compatibility was inspected in source; no device/TestFlight validation or native streaming UI is claimed. Native mode selection is not added in this change.

Run the deterministic integrated UI preview with `node tests/research-fast-http.mjs --serve`. It prints a loopback-only synthetic-account launch link. Its canned answer is a transport/UI fixture, not a live model result.
