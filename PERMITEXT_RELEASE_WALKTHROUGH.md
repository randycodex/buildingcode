# Permitext focused release walkthrough

This is the human QA pass that remains useful after the automated contract, smoke, and iOS tests. It is intentionally shorter than `PERMITEXT_BUG_AUDIT.md`: do not manually retest implementation details that the UI cannot prove.

## Test setup

- One Free Permitext account.
- One Pro organization owner.
- Three separate invited accounts: Editor, Reviewer, and Viewer.
- Web and iOS signed into the same test account where a cross-device step calls for it.
- One organization-owned Project with:
  - a saved code section;
  - a Notebook card;
  - a completed Research answer;
  - a Workboard drawing with an image;
  - at least one generated Report.

Record the browser/device, account role, result, and screenshot for every failure.

## 1. Free-plan language and limits

- [ ] Open iOS Settings while signed into the Free account.
- [ ] Confirm the Free description includes reading, search, recents, 25 saved sections, 10 notes, continuity, and cross-device sync.
- [ ] Trigger a Pro-only action such as PDF export, tags, Projects, or Workboards.
- [ ] Confirm the upgrade message describes the actual Pro features and does not claim that continuity or cross-device sync require Pro.
- [ ] Save sections from more than one code package until the account reaches 25 total.
- [ ] Confirm the next save is blocked with the Free saved-section limit message, regardless of which code package is open.
- [ ] Repeat across code packages for the account-wide 10-note limit.

Expected result: iOS preview behavior agrees with the server's account-wide limits and the copy never contradicts the Free entitlement.

## 2. iOS deletion survives synchronization

- [ ] Create and sync a bookmark from iOS.
- [ ] Confirm it appears on the web.
- [ ] Delete it on iOS.
- [ ] Trigger foreground sync, leave and reopen the Saved view, and wait for the web client to refresh.
- [ ] Confirm the bookmark stays deleted on iOS and disappears on the web.
- [ ] Repeat once after restarting the iOS app before the delete finishes syncing.

Expected result: the deleted item never briefly becomes a permanent live item again. A genuine newer competing edit may produce a visible conflict, but the queued delete must not silently disappear.

## 3. Viewer access

- [ ] As the Viewer, open the shared Project.
- [ ] Confirm the Project overview, current Workboard preview, Report history, Report manifest, and Report PDF can be opened.
- [ ] Confirm Report Draft editing, Report generation, Workboard editing/clearing, Notebook editing, and organization administration are unavailable or rejected.
- [ ] Remove the Viewer from the Project and refresh.
- [ ] Confirm all private Project access is revoked.

Expected result: the Viewer has useful read access and no mutation path.

## 4. Reviewer access

- [ ] As the Reviewer, open the same shared Project and its Report history.
- [ ] Download the existing Report PDF.
- [ ] Complete one supported review action, such as approving selected evidence or resolving a missing-information thread.
- [ ] Attempt to save a Report Draft and clear the Workboard preview.

Expected result: review and Report-download permissions work; Project-content editing remains blocked.

## 5. Editor writes remain in the shared Project

- [ ] As the Editor, create a Report Draft in the shared Project.
- [ ] As the Owner, refresh Report Drafts and confirm the Editor's draft appears with the Editor's attribution.
- [ ] As the Editor, change the Workboard and save a new preview.
- [ ] As the Owner and Reviewer, refresh the Project Hub and confirm the new preview appears.
- [ ] Sign the Editor out and back in, then confirm the same shared artifacts remain available.

Expected result: Editor changes are stored once under the organization-owned Project, not fragmented into a private copy owned by the Editor.

## 6. Immutable Report history

- [ ] Generate a Report from the prepared Project.
- [ ] Open its web PDF and create/open the native iOS PDF.
- [ ] Confirm the title, Project identity, selected evidence, citations, limitations, Workboard preview, firm branding, and disclaimers are present.
- [ ] Change the firm's current branding or Report template.
- [ ] Reopen the older Report from history.

Expected result: the old Report retains the presentation and evidence snapshot used when it was generated; a new Report uses the revised firm settings.

## 7. Apple subscription and backend package capabilities

- [ ] Use an account whose backend package includes Pro plus the Research Add-On.
- [ ] On iOS, refresh purchases or restore the Apple subscription.
- [ ] Confirm Pro remains active and Research remains available.
- [ ] Background and foreground the app, then repeat the check.
- [ ] Sign out, sign back into the same Permitext account, and repeat the check.
- [ ] Sign into a different account without the Research Add-On and confirm the first account's Research capability does not leak across accounts.

Expected result: StoreKit can verify Apple Pro without erasing backend package identity, add-ons, provider metadata, or account ownership.

## 8. Basic cross-device Project flow

- [ ] On the web, save evidence into a Project and add a Notebook note.
- [ ] On iOS, refresh the Project Hub and confirm both appear.
- [ ] Generate or save the Project Report.
- [ ] On the other client, open the Report from history and verify the same evidence and limitations.

Expected result: the professional flow works end to end: Project → saved evidence → Notebook → Research → Report → iOS review.

## Do not use the walkthrough as proof of these items

The following require automated or production diagnostics, not visual inspection:

- concurrent invitation requests at the final organization seat;
- duplicate invitation races;
- member reactivation at the seat boundary;
- PostgreSQL compatibility-store reconstruction of Workboards;
- parallel Research reservations at the monthly limit;
- Stripe webhook delivery and out-of-order event handling;
- distributed rate limiting across regions;
- prepared canonical section-body coverage;
- file-store inter-process locking.

A clean walkthrough means rendered behavior and real client interaction look correct. It does not replace PostgreSQL concurrency tests, billing-event verification, deployment health, or App Store configuration checks.
