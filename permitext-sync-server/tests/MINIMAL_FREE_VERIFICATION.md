# Minimal Free access verification — 2026-09-19

Implemented for native iOS and web: one-screen welcome; guest and Free code browsing, enacted-text reading, references and search; Pro required for saved work, notes, Projects (including reference collections), personal Research, Notebook and Reports. Existing saved records are retained after downgrade. Server-side writes enforce the same boundary, with deletion and continuity allowed.

Guest reading/search context carries into sign-in. Blocked saves can resume after Pro activation, with expiry and account isolation. Web Saved prompts without adding a locked column.

## Verified locally

- `npm run test:minimal-free-access`: entitlement rules, stale capability rejection, isolated HTTP Free/Pro/downgrade behavior, retained data, save continuation, Saved entry points, first-use contract.
- Project foundation, settings wording, Reader/save, web account isolation and mutation isolation, offline, offline recovery and shell cache contracts passed.
- Debug iOS build succeeded. Two targeted EntitlementAndSyncContractTests passed on the physical iPhone.
- Physical iPhone: welcome and Explore, enacted chapter reading, save upgrade prompt and cancellation preserving the chapter, Free search results, Research gate and dark-mode action contrast.
- Local browser: enacted Reader and Search remain available; Saved shows a dismissible prompt without a locked column.
- `git diff --check` passed.

## Limits and release status

The broader smoke suite stops at its existing Search count/layout assertion, which also fails against the original HEAD sources. It is not recorded as passing. No live paid signup or subscription purchase was performed; upgrade continuation was checked with synthetic tests. PostgreSQL access decisions were checked by contract, not against a production database.

No push, production deployment, TestFlight upload or App Store release was performed. The physical phone was left signed out with its debug Free override for verification.

## Dedicated account welcome follow-up

Signed-out web and iOS account entry now uses text-only `permitext` branding with Create account, Sign in, and Continue exploring. Signed-in accounts bypass this welcome. Native Create account and Sign in were visually verified on the physical iPhone to open their respective Clerk forms, without submitting credentials. The web welcome and cancellation were visually verified locally. Synthetic redirect checks cover signup/sign-in routing, existing-session reuse, and section return context. Native build and Clerk auth/loader, account isolation, minimal Free and shell cache checks passed.

The separate public landing website is on hold. Its agreed Explore action will allow entry without sign-in.
