# PERF-11 acceptance audit

Local implementation checkpoint: `e05e9a551`. This checklist does not replace the priority plan or mark PERF-11 complete.

1. **Render entry points — partial.** Full and utility rendering mount shells independently. Reader/result navigation waits for its target. Saved Project-transition readiness has a follow-up fix and passing actual-caller regression. Review continuity-triggered callers before closing this item.
2. **Ordered independent publication — supported.** Coordinator contracts and controlled delayed-sync browser checks establish public publication and retained nodes. An unfinished Reader can still restart if normalization changes its descriptor identity; inspect before claiming no redundant work.
3. **Verified cached continuity — partial.** Provenance contracts distinguish completed verification, permitted transport fallback and denial. Rendered permitted-offline restore plus remote continuity changing the active workspace remains unverified.
4. **Private access — partial.** Browser sync 403/retry and actual sign-out pass; old gate references deny access after sign-out. Rendered A-to-B account change, same-user session replacement and shared Notebook viewer/denial remain to verify.
5. **Isolated failure/retry — partial.** Actual Retry and coordinator tests pass. Browser sync failure leaves public panes usable. Render an individual Notebook/Report failure beside usable neighboring editors to finish this scope.
6. **Editor and layout preservation — partial.** Mixed browser evidence retains Notebook draft/focus/selection when Report finishes; public panes retain Search focus/selection after sync. Broad capability-based private pane identities can discard Report drafts after unrelated capability changes; pane-specific capability correction now passes regression tests. Verify relevant permission revocation and resize/drag geometry separately.
7. **Request reuse — under review.** Project transition payloads validate account/session/workspace/project. Establish actual mixed-fixture request counts before claiming redundant network work has been eliminated. Do not coalesce intentional mutations or refreshes against stale inputs.
8. **Complete fixture — partial.** Synthetic multi-pane evidence covers delayed Report and delayed/denied sync. Combine the outstanding access, failure, offline and geometry checks before closing PERF-11.

Evidence: `PERF_11_MIXED_BROWSER_EVIDENCE_2026-09-23.json`, `PERF_11_PUBLIC_STARTUP_BROWSER_EVIDENCE_2026-09-23.json`, expanded `test:workspace-access`, `test:workspace-pane-hydration`, offline and smoke suites. These are local functional checks; they do not establish production or physical-device latency.

Follow-up findings: the Saved target-readiness correction passes its actual-caller test and the full access suite. Source inspection confirms restored Saved and Notebook both request the same Project foundation when no transition hub exists; a strictly in-flight, identity-scoped read-sharing fix now passes deferred request/isolation/failure tests. Distinct Report endpoints and intentional later Saved refreshes are excluded from this finding.
