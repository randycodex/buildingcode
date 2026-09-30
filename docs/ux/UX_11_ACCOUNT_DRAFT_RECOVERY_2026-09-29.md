# Pending Note isolation across account replacement

Status: passed locally on web610/shell1253, source da0b72803. This is a rendered two-account browser test using the isolated populated fixture, not Clerk/Apple session expiry, Production or physical iOS acceptance.

1. Started the small populated fixture at port8824 with --second-account true. Its setup verified distinct authenticated sessions, empty secondary workspace, and rejection of a cross-account request. No owner data or external providers were used.
2. Account A opened Synthetic Project 1 / Synthetic Note 4. Armed20 failures for the actual /notebook/cards/save endpoint and replaced the synthetic text with `ACCOUNT-A-ONLY: pending draft must survive A to B to A.` Server readback remained version1 with the original text.
3. A second same-origin tab bootstrapped account B, triggering the original tab's account-storage transition. The original tab displayed No columns open, Create workspace or project and Synced; A's Project, Notebook and private text were absent. No A pending count was shown as B's work.
4. Returned to A through the fixture bootstrap while failures remained armed. The original tab restored Synthetic Note4, the exact marker and Changes pending ·1. Metrics recorded six503 saves and14 failure uses still armed.
5. Cleared the save failure, closed the second tab and reloaded the original tab. Server readback returned the same Note ID at version2 with the exact marker; rendered body matched and status was Synced. Thus the draft survived the account replacement and one accepted server revision persisted it.

Screenshot: /tmp/permitext-account-draft-recovery-20260929.png. Fixture process and temporary tabs were closed. No product patch was necessary. This closes the bounded rendered pending-draft A→B→A gap; it does not replace real provider sign-out/session-expiry, hosted candidate or native acceptance.
