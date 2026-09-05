# Account deletion identity verification repair — September 5, 2026

## Recovered Production finding

The previous readiness task reached a partial account-deletion result against
Production application source `0985728b26e5b247d758fce26c4e0739efef986f`.
The owner had completed the designated disposable account's deletion through
the customer interface. Saved aggregate evidence at `2026-09-05T14:44:31Z`
confirmed the backend account, entitlement, sessions, credentials, mutations,
and all exported content families were absent. Attributable browser saves,
notes, and collections were cleared; unattributed legacy data was preserved.

Clerk identity removal did not complete. The saved task's runtime-log
investigation identified `session_reverification_required`: the deletion path
called the SDK's user deletion directly without opening fresh verification.
At `2026-09-05T14:46:44Z`, clicking Sign in recreated the same Permitext identity
with an empty Free account and a session. This does **not** prove full provider
deletion or a clean fresh-identity recreation.

The operator credential replacement and Free-account export had already passed.
Do not repeat credential setup based on older acceptance text. The [preparation
record](./PERMITEXT_ACCOUNT_ACCEPTANCE_PREPARATION_2026-09-05.md) retains its
earlier snapshot. Private aggregate summaries remain under
`/private/tmp/permitext-disposable-account-acceptance-20260905`; raw exports and
secrets are not copied into this document.

## Local repair

- Web verifies the captured Clerk identity before sending the irreversible
  Permitext deletion request. Cancellation, unavailable verification, account
  changes, and incomplete verification stop the request. A separate lazy bundle
  mounts the supported Clerk React hook against the existing Clerk instance.
- Cleanup can request verification again if it expires while backend/device
  cleanup runs. That retry removes only the captured sign-in identity and never
  replays backend deletion. An intervening account/session change blocks it.
- Native uses the pinned Clerk SDK's session verification API before backend
  deletion. Password, email/SMS code, authenticator and backup-code methods are
  limited to the factors the SDK returns. Unsupported methods fail before data
  deletion. Delayed responses and canceled tasks cannot resume deletion.
- The native cleanup sheet is attached to the persistent Account view, so
  backend deletion signing out does not remove the stage results/retry surface.
  Verification inputs stay in transient view/task memory and are cleared on
  submit or dismissal.
- The cleanup sheet uses the available sheet width and height. Verification
  instructions distinguish entering a received code from requesting another.
- The Debug account fixture now isolates its private cache alongside its other
  temporary data. The guarded Xcode wrapper supports `test-ui-simulator` using
  the existing UI scheme, shared build directory, lock and nonparallel testing.
- Web shell keys advance together to `20260905-account-verification-ready-v42`
  and `permitext-pro-shell-v781`; verification bundle URL v3 remains lazily loaded.

Implementation references: [Clerk reverification guide](https://clerk.com/docs/guides/secure/reverification)
and [supported React hook](https://clerk.com/docs/react/reference/hooks/use-reverification),
checked alongside the installed SDK sources. No SDK/provider security setting
was changed.

## Verification

- The actual built React/Clerk hook passed **7/7** isolated browser integration
  checks: preflight; cancellation; changed identity; actual Clerk API error
  recognition and one cleanup retry; incomplete verification rejection; and
  repeated mount/unmount preserving the shared session; and an already-loaded
  session that emits no new ready-status notification.
- The synthetic provider prompt was rendered and cancellation was inspected in
  the connected browser, with no console warning/error. Its dialog is an
  explicitly labeled test double, not Clerk's live verification UI. The fixture
  permits no network API calls and uses no credentials or persistent account data.
- Browser reproduction: build with `npm run build:account-verification`, run
  `node tests/account-verification-browser.mjs`, open its dedicated loopback URL,
  and choose **Run integration checks**.
- `npm run check`, `npm run test:auth`, `node tests/smoke.mjs`, and
  `npm run build:clients` passed. The final generated bundle also passed the
  account-deletion and offline source contracts. Packaging-correction bundle: 421,325 bytes;
  SHA-256: `742a0b5061414e4423ee3b7a4d6b598e82e392c978416f05eef4cb63ef4d83a9`.
- The isolated native UI test passed **1/1** on iPhone 17 Pro / iOS 27 Simulator:
  open Account, confirm deletion, retain completed backend/device results after
  sign-out, dismiss with Done, and confirm the signed-out Account state. Its
  captured screen was inspected. The fixture disables Clerk and uses synthetic
  local transports; this does not establish live provider deletion.
- The final focused native model/contract rerun passed **9/9**. It covers multi-factor
  completion, cancellation and late responses, account changes, invalid-code
  retry, unsupported methods, transient input, and account-deletion ownership.
- Initial test-harness issues were corrected: an outdated contract expected the
  old popover; the legacy Debug fixture uses an icon-only first tab and Apple-only
  sign-in; its private cache was not yet isolated. The earlier failure screenshot
  independently showed that the cleanup failure/retry surface survived sign-out.

Retained verification evidence:

- `/private/tmp/permitext-account-verification-web-check-recovered-20260905.log`
- `/private/tmp/permitext-account-verification-auth-recovered-20260905.log`
- `/private/tmp/permitext-account-verification-smoke-recovered-20260905.log`
- `/private/tmp/permitext-account-verification-build-recovered-20260905.log`
- `/private/tmp/permitext-account-deletion-sheet-ui-isolated-20260905.log`
- `/private/tmp/permitext-deletion-sheet-ui-final-20260905/`
- `/private/tmp/permitext-account-verification-native-final-20260905.log`
- `/private/tmp/permitext-verification-native-final-images-20260905/`

Final result bundles are `Test-permitext-2026.09.05_13-08-00--0400.xcresult`
and `Test-permitextPhysicalStress-2026.09.05_13-03-35--0400.xcresult` under
`/Users/randy/Library/Developer/Xcode/DerivedData/PermitextShared/Logs/Test/`.
The final verification-code screen was also inspected. Guarded cleanup retained
all candidates because Xcode was active; no storage safeguard was bypassed.

Native reproduction (with the selected Xcode developer directory):

```sh
./Tools/permitext_xcode.sh test-ui-simulator -quiet \
  -only-testing:permitextPhysicalStressUITests/NativeReaderPhysicalStressUITests/testAccountDeletionResultsRemainVisibleAfterSignOut
./Tools/permitext_xcode.sh test-simulator -quiet \
  -only-testing:permitextTests/AccountDeletionVerificationTests \
  -only-testing:permitextTests/EntitlementAndSyncContractTests/testAccountDeletionRequiresExplicitDisclosureAndReportsCleanupStages \
  -only-testing:permitextTests/EntitlementAndSyncContractTests/testAccountDeletionCompletionDoesNotClearAnotherAccount
```

## Publication packaging correction

PR #46 published source `68efc23956939bfd79d592173db8cce5628cc3a8` after
its preview passed. Production health, approved policy bytes and AASA checks
passed on both canonical origins. The byte-identity check caught a difference
in the new bundle: Vite included local/hosting `VITE_*` configuration metadata
through a dependency's environment lookup. The remaining application assets
were unchanged by this finding.

The bounded web follow-up disables environment-file loading and automatic
environment-prefix exposure for this standalone bundle. Clerk and its public
key continue to arrive through the existing runtime instance. Two builds with
different synthetic environment values produced identical final bytes; neither
the synthetic value nor local/hosting configuration entries were embedded.
All six actual-hook browser checks and the account-deletion/offline contracts
passed again. Native inputs did not change; build 59 was archived from the
original repair source above. The follow-up Production byte check passed as
recorded below.

## Verified web publication and build 59

- PR [#46](https://github.com/randycodex/buildingcode/pull/46) published the initial
  repair; PR [#47](https://github.com/randycodex/buildingcode/pull/47) published the
  packaging correction by fast-forward to
  `7a283d5f27d14df59cf3b18cdb81b143939b5e62`. Local `main`, GitHub `main` and the
  repair branch matched at the publication checkpoint.
- Final Production deployment `dpl_G66zX8VntFbCaV5MFBouTPrSYNPu` is READY.
  Both `https://permitext.com` and `https://permitext-sync.vercel.app` returned
  that exact source. On both origins, index, app, offline storage, service
  worker, styles and the verification bundle matched local committed bytes.
- Both origins passed PostgreSQL `normalized-v4`/live Clerk configuration health,
  AASA app ID `57BY95X97H.com.randycodex.permitext`, and strict approved-policy
  byte checks. The browser rendered release `7a283d5f27d1` and the existing empty
  Free account with no console warning/error. Its legacy unowned-data warning
  remained visible and those bytes were preserved.
- The Vercel grouped runtime-error query starting at `2026-09-05T17:32:00Z`
  returned no errors when checked after publication. This is a short project
  observation, not sustained-operation acceptance.
- Native build `1.0 (59)` was archived from
  `68efc23956939bfd79d592173db8cce5628cc3a8` at
  `/private/tmp/permitext-1.0-59-68efc2395.xcarchive`. The native runtime tree
  `1b3dc5bbf0381f6c2d19e83c01fc0bfdcf233cd7` and Xcode project inputs are identical
  in the final web source. The web-only follow-up did not require another archive.
- Strict deep signing, team/entitlement comparison against build 58, Production
  backend/live Clerk configuration, pinned clean dependency checkouts, and
  semantic privacy aggregation passed. Privacy remains 13 collected-data
  categories, three required-reason API groups and no tracking. This is archive
  evidence, not an Organizer report or independent provider-policy attestation.
- Apple reported `Upload succeeded` at `2026-09-05T17:32:22.268Z`, followed by
  `EXPORT SUCCEEDED` and exit 0. The signed executable remained unchanged after
  upload: SHA-256 `f7e326a50df3f7bc5d5380a8a268e7300c05d3b8df07633c990a1161db36e6bd`.
  App Store Connect showed build 59 Processing; internal availability and physical
  build-59 acceptance remain pending at this checkpoint.

Retained publication evidence: `/private/tmp/permitext-account-verification-production-20260905.json`,
the matching policy audit files, `/private/tmp/permitext-build59-final-evidence.json`,
`/private/tmp/permitext-build59-privacy-aggregate.json`, and
`/private/tmp/permitext-build59-upload.log`.

The owner made the physical phone available. Before updating, build 58 still
showed Lifetime Pro active, 98 included Research turns, Synced status, existing
Project containers and the saved Electrical provision. Account identifiers and
private Project names are not copied into this record.

The designated disposable web account was exported again at
`2026-09-05T17:35:40.153Z`. Its identifier hash still matches the preparation
record. All mutation/content/artifact/ownership families are zero, no entitlement
exists, and one session-metadata record remains. No shared-ownership review is
required. Only an aggregate summary was retained; the raw export was not saved.
The owner explicitly approved deletion of this exact account. This is a different
account from the phone's Lifetime Pro account.

### Live verification startup correction

The first approved live attempt stopped before backend deletion with
`Secure identity verification could not open`. The lazy React view waited behind
`ClerkLoaded`; an already-loaded shared Clerk instance can miss the new provider's
ready-state notification. The original synthetic provider always replayed that
notification and did not expose this timing condition.

A new regression scenario suppresses the replayed notification. It reproduced
the same timeout with the published bundle. The verification request now mounts
directly inside the provider after the existing explicit `clerk.loaded` check,
using the SDK's queued operation support without waiting for another render.
The corrected bundle passes all **7/7** browser checks plus account-deletion and
offline contracts. Its size is 421,145 bytes and SHA-256 is
`e01b0c0614af928b73b62bc13c68e643ca462878fd3605cb6155292cbf7c4146`.
Native inputs are unchanged. Publication and another live
attempt remain pending; the existing exact-account approval is retained.

## Acceptance boundary

The final web repair is on Production and build 59 has uploaded; Apple processing
and physical checks remain in progress at this checkpoint.
No account deletion, provider cleanup, new paid Research call, or provider
configuration change was performed in this recovery task. Live Clerk prompt
and full account-lifecycle acceptance remain open, including private-file and
second-client coverage. Any destructive exercise requires the exact currently
reviewed disposable target/scope; preserved historical evidence is not a new
destructive authorization. Public-release gates remain open.
