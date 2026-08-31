# Permitext Zoning Remediation Successor 3 — Locked V11 Confirmation Package

Date: August 31, 2026

Branch: `codex/zoning-research-beta1`

Exact package commit: `8d075b442083db3536de0ff9e90372802ddeadaa`

Status: locked, independently reviewed, not authorized, not run

## Outcome

The distinct Zoning safety v11 paid-confirmation package is prepared and has passed its complete no-cost package gate. No paid provider request was made, no semantic result was produced, and no retained result was rescored.

Authorization ID `ee72ca2f-5410-4ce9-a6d6-30deb8ff5169` remains `locked`. Its owner authorization, case count, repetition count, spend cap, package commit, execution commit, attempt ID, and run ID are null/not started. Public Zoning Research, the disabled 24,000-character candidate, deployment, pricing or allowance changes, and professional Zoning signoff remain false.

Preliminary package commits `682e7fcfd26390207e310b228be43fb74d72b1ab` and `981c02a2b284fb2207b9ffba4a9c4100dfa56d44` were superseded before owner authorization. They are not approved alternatives and must not be run.

## Exact package bindings

| Input | Exact binding |
| --- | --- |
| Prepared-from reviewed repair commit | `cd1f3a99f32a3648dd8f0d7a8b1d540e5db29bf5` |
| Frozen 30-case cohort | `852e521f427a418eb18c1bd45e3e764736ae50cbb09d0d0a46ce64f8cad893fc` |
| Zoning safety v11 | `8003374fb8302a69bdcb924e2e6fe66855c11f52444f045dfb6e75bff1b476f7` |
| Research economics | `d4816da6162137e122355494a3f2954dca09fc9d8978b85eb682516d29ec5ae0` |
| Application | `1b907f5db72f65248489b80801904a2011b2df91ce5d739a7e6dc39cce702797` |
| Locked authorization JSON | `c5b89c1dd7dca9109e0be01ab78763e6da108cace19dc2fb92f4cc6aed56c024` |
| Signed runner-handoff module | `e45975a2d028d5d9852032fe6c107aacf0d3e7d18586ba41ae7eac4a2b4df327` |
| Runner public key, DER bytes | `7830127ce97437dcb85971faecfac4ad031288d4f98608837fa5c22aa2c64918` |
| Historical consumed v9 authorization | `ffa134fc6f2855264ff54c8b285ba49f3bb16ab908b712072854d61bc2eb39e4` |
| Historical v9 run | `00570309-e1f2-441b-9f09-8df4f0603253` |

The parent and child independently rehash the selected package, locked authorization, frozen cohort, historical reviewed v11 safety/economics/application bytes, signed handoff module, and retained v9 lineage before a paid execution can proceed.

## Authorization and execution boundary

An active record must bind the selected 40-character package commit and preserve this exact owner sentence in both authorization fields:

> authorize exactly package commit 8d075b442083db3536de0ff9e90372802ddeadaa for all 30 ordered cases, one repetition, with a maximum cumulative API spend of $5.

No shorthand or earlier general instruction activates the package. After any exact owner decision, a separate clean execution commit must contain only the authorization-state change in `permitext-sync-server`; the runner then requires the global and cohort locks, enters a durable non-reusable attempt state before dispatch, binds one result to that attempt/run ID, enforces the `$5` cumulative ledger cap, and stops at the first execution error.

## Authenticated runner handoff

The package adds a committed Ed25519 challenge-response handoff between the consuming runner and evaluator. The signed payload binds the protocol, run ID, exact execution commit, parent process, child process, and a fresh challenge. The child rejects missing, malformed, unsigned, wrong-key, stale, mismatched, and replayed handoffs before provider access.

The runner's private key is owner-controlled, stored outside committed content under `.git/` with owner-only file permissions, and is never placed in the child environment, locks, or retained result. The package intentionally states the honest boundary: this protects against accidental direct CLI use, replay, and unsigned custom parents, but it is not an operating-system security boundary against malicious code already running as the same trusted macOS user and able to access that user's local credentials.

## Reviewed runtime

Both the parent and child enforce the reviewed execution state:

- production mode;
- web support disabled;
- model-evidence analysis disabled;
- disabled 24,000-character evidence candidate;
- answer reasoning effort `medium`;
- judge reasoning effort `medium`;
- test, database, Vercel, Node preload/path, custom-CA, proxy, model-routing, pricing, cap, and feature overrides scrubbed or replaced with exact reviewed values;
- TLS certificate verification enabled; and
- provider credentials absent throughout every no-cost check.

The independent reviewer confirmed all 33 material model, routing, prompt, evidence, pricing, cap, judge, and feature settings were overwritten with reviewed values. Remaining inherited Research settings were verified inert for this run path.

## No-cost verification

All checks below passed against exact package commit `8d075b442083db3536de0ff9e90372802ddeadaa`:

- focused v11 authorization contract;
- exact owner-sentence, package-SHA, case-count, repetition, and `$5` scope rejection tests;
- tracked-file and package-hash checks;
- forged direct-evaluator and unsigned-parent rejection before provider access;
- valid signed IPC plus replay rejection;
- hostile-environment runtime override probe, 33/33 material settings;
- authorization restoration and lock cleanup after test fixtures;
- v9 historical guard;
- Zoning safety contract;
- frozen 30-case canonical mock preflight, 30/30 evidence-ready with zero tokens and zero paid calls; and
- complete `npm run check`, exit code 0.

Hilbert's final independent exact-commit review returned clean within scope with no material findings. The review verified the tracked handoff module, parent/child hash checks, honest same-user boundary, pinned reasoning and evidence settings, exact owner-phrase validator, locked inactive authorization, and clean `permitext-sync-server` package state.

## Decision gate

Package preparation is complete. The paid confirmation remains open and unauthorized. If the owner supplies the exact sentence above, the authorized next action is limited to all 30 ordered remediation-successor-3 cases, one repetition, and a maximum cumulative API spend of `$5`.

Even a complete passing run would not by itself authorize public Zoning Research, the evidence-budget candidate, a pricing or 100-turn allowance change, merge, push, deployment, TestFlight release, or final public release. It would provide the missing semantic/reliability/cost evidence for the next decision.
