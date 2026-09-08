# Research confirmation: pre-dispatch guard stop

September 8, 2026. Local diagnostic only.

The first eight-question confirmation package stopped on FGC-03 before sending a provider request. Its $0.60 per-turn cap rejected the conservative request bound. The immutable result records zero provider calls, zero provider reservations, zero usage and zero provider costs; seven questions were skipped. This is a failed diagnostic attempt, not an answer result. The earlier pilot remains the only paid run at this point.

This exposed a reservation-order bug: the evaluation ledger reserved $0.255903 before the independent per-turn guard rejected the request. That pending amount was bookkeeping, not an incurred charge. The provider client now releases that particular evaluation reservation when the subsequent guard rejects before dispatch. Dispatched requests with missing usage, timeouts or uncertain responses retain their allowance. Reservation identifiers remain monotonic, and repeated cancellation cannot remove another reservation.

Local contracts cover first-request rejection, preservation of an independent outstanding reservation, idempotent cancellation, an unsent retry following an uncertain dispatched request, timeout and abort behavior. Provider, cost guardrail, economics, economics persistence, and spend-control acceptance checks passed.

The replacement one-attempt runner is `permitext-sync-server/scripts/run-research-owner-confirmation-v2-20260908.mjs`. It verifies that the retained first attempt dispatched no requests and records that result's SHA-256. It uses the same eight questions with a local $0.85 per-turn ceiling and $7 evaluation cap. Eight turns have a $6.80 sum ceiling; adding the earlier pilot's $1.065597 conservative settled cost gives $7.865597, within the owner's approximately $8 total authorization. No production cap or routing setting changes. The runner's default no-network preflight passed. Live outcomes will be recorded separately; preparation is not evidence of success.

Retained result: `permitext-sync-server/evals/results/research-owner-live-source-confirmation-2026-09-08.json`, source commit `894ba7035d086a3115ba4731243eff7968c447b8`.
