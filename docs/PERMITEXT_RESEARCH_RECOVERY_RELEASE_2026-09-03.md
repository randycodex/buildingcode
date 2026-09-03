# Research recovery release — September 3, 2026

Status: **released to Production and Internal TestFlight; build 52 installed, basic physical-device continuity verified, and one separately authorized live Research answer completed**. The checks below were observed through iPhone Mirroring. The [controlled ramp test](./PERMITEXT_BUILD52_RAMP_LIVE_TEST_2026-09-03.md) passed delivery, reopening, and one-turn allowance checks in 34.9 seconds at $0.057825 estimated API cost; answer completeness and the remaining table-gesture check are still open.

## Authorization and source identity

The owner approved applying the verified Luna/Terra configuration and publishing the backend correction plus a replacement TestFlight build, with spending limits and subscription pricing unchanged and **no paid Research calls**.

- Exact released source: `1873ba6453bf6f3d1f076e34fa2ddfb96b9cf40c`.
- Local `main` and GitHub `origin/main` were verified equal to that commit. The existing uncommitted Xcode project/Info.plist formatting changes and unrelated untracked files were preserved.
- Native archive built from the clean isolated `codex/research-failure-recovery` checkout at the exact commit, with build/version/backend supplied as build-time arguments, not a changed source tree.
- The original build-51 Research authorization remains consumed. This release does not authorize another question, retry, or paid evaluation.

## Production configuration

Twelve existing Production-only environment variables were updated successfully. Vercel does not permit converting an existing sensitive variable directly to readable configuration, so their existing sensitive storage type was preserved; no variable was deleted. Values below are the acknowledged write payloads, not a claim of decrypted readback.

| Purpose | Configured value |
| --- | --- |
| Routing mode | `hybrid` |
| Base and accurate model | `gpt-5.6-terra` |
| Fast model | `gpt-5.6-luna` |
| Terra input / cached input / output per million tokens | `$2.00 / $0.20 / $12.00` |
| Luna input / cached input / output per million tokens | `$0.20 / $0.02 / $1.20` |
| Both pricing versions | `openai-standard-2026-09-03` |

These are the verified standard short-context rates in the [OpenAI pricing reference](https://developers.openai.com/api/docs/pricing). The released request guard separately preserves the reviewed long-context/cache-write, image, and web-tool allowances and pins the standard service tier. This is internal cost accounting, not a change to the customer's $20 Pro subscription price.

Read-only before/after metadata comparison proved that all five cap variables retained their existing update timestamps: per-turn, per-user daily/monthly, and system daily/monthly. No Stripe/Apple price, subscription allowance, Research kill switch, Zoning gate, or paid-evaluation switch was changed.

The automatic deployment started while configuration updates were still in progress. It was canceled in `BUILDING` state before promotion (`dpl_GmogdEuLSZr3EJ9WshteamEaJiV2`). The previously serving release was verified unchanged. A fresh deployment was then created after the last of the twelve writes completed, so the released build uses the complete new configuration.

## Production evidence

- Deployment: `dpl_CRPoXH4RrtrKVn3MLBgrrcLFdsr9`, `READY`, target `production`.
- Deployment URL: `https://permitext-sync-jmyt7jolr-randycodexs-projects-b72fc111.vercel.app`.
- Created at `2026-09-03T22:46:29.836Z`; deployment completed at approximately `22:48:39Z`.
- Both `https://permitext-sync.vercel.app/release` and `https://permitext.com/release` returned HTTP 200, the exact source SHA above, and environment `production`.
- Protected deployment build passed commercial configuration, live Stripe configuration, exact release identity, and the accepted external-monitoring configuration.
- `npm run verify:production` passed: PostgreSQL, `normalized-v4`, commercial readiness, and live Clerk configuration.
- AASA passed with exact app ID `57BY95X97H.com.randycodex.permitext` and the section-link route.
- Strict exact-hash publication audits passed for terms, privacy, and refunds on both canonical origins.
- The first deployment-scoped error-log scan, beginning at READY and queried more than 60 seconds later, returned no error rows. This is a short early observation, not a claim of zero future errors or a complete Research journey.

## Native build 52

- Version `1.0`, build `52`, bundle ID `com.randycodex.permitext`.
- Archive: `/private/tmp/permitext-1.0-52.xcarchive`.
- Backend: `https://permitext-sync.vercel.app`; live Clerk publishable-key configuration present.
- Native Reader rollout: `isolated-table-fallback`; `ITSAppUsesNonExemptEncryption=false`.
- Strict deep code-signature verification passed before export.
- Archive executable SHA-256: `abff19908971e29ef9c2cc99ea60ea8c474b08f300c69b75320ddde31fdc21c6`.
- All 111 prepared 2014 chapter documents and 285 local media files are bundled. The archive's `chapters/bc-7.html` is byte-identical to the source file.
- Local repair verification remains 163/163 native unit tests, the passing rendered failure/reopen journey, full server checks, and focused request-envelope/provider/attribution regressions. See [repair evidence](./PERMITEXT_RESEARCH_FAILURE_RECOVERY_2026-09-03.md).
- Export/upload: `Upload succeeded` at `2026-09-03 18:54:46 EDT`, followed by `EXPORT SUCCEEDED`.
- App Store Connect subsequently reports version `1.0`, build `52`, upload status `Complete`, build status `Ready to Submit`, and assignment to `Internal Testers` (one tester). Build record: `3517282c-15ae-45d4-aa51-083775695906`. This establishes internal availability, not external Beta App Review or public App Store approval.
- Build-specific test notes were saved successfully, asking for sign-in/Pro/sync/Saved/Projects/2014 Reader continuity and distinguishing any new Research submission as a separate controlled test. The release page was left open for the owner.

The guarded archive workflow used command-local Xcode selection and its build lock. The temporary worktree failed the cleanup guard's repository validation, so no cleanup was performed or bypassed. No user's app, simulator, or local data was reset.

## Acceptance boundary

### September 3 physical-iPhone continuity check

The owner reported build 52 installed and explicitly authorized using the physical phone. Direct iPhone Mirroring inspection at approximately 19:11–19:14 EDT established:

- TestFlight displays version `1.0 (52)` and opens Permitext after its build-specific test notes.
- The app opens successfully. The existing account remains signed in, with `Lifetime Pro` active and `Synced` displayed.
- Existing Projects and a saved section remain visible. An existing Project opens and finishes loading its synced records.
- The 2014 Building Code selector and Chapter 7 open in the native Reader without `Chapter HTML Missing`. Chapter search returns results and navigates to selected content.
- Figure 705.7 displays its complete graph, axes, and caption in the Reader and in the enlarged image viewer; no cropping was visible in this example.
- Table 705.8 renders as a structured table and vertically scrolls to additional rows. The rightmost column extends beyond the narrow viewport, and automated horizontal scroll attempts through Mirroring did not move it. This is an **unresolved gesture check**, not a complete table pass or proof that physical touch scrolling is broken. Source inspection confirms a horizontal scroll container, but does not substitute for device acceptance.
- Research history and an existing conversation open. No question was entered or submitted, no retry was tapped, and no purchase, restore, sign-out, deletion, or account mutation was performed. The old failed ramp request's restored state was not established by these checks.
- A fresh read-only Production `/release` check still returned `1873ba6453bf6f3d1f076e34fa2ddfb96b9cf40c`. No backend configuration or binary was changed for these checks.

Account identifiers and Project content are intentionally omitted from this durable record. The displayed remaining-turn count is not evidence of the original failed attempt's ledger outcome.

The subsequent [separately authorized ramp test](./PERMITEXT_BUILD52_RAMP_LIVE_TEST_2026-09-03.md) establishes one completed/reopened answer, correlated server timing and estimated cost, and one visible allowance decrement. It does not establish complete answer coverage, performance with the original Project facts, independently reconciled invoiced spend, the original failed attempt's persisted turn ledger, or physical touch access to every table column. Both single-turn authorizations are consumed. Existing failed conversations cannot acquire an answer merely from this update. Another live attempt requires a separate exact authorization; no App Review or public App Store submission is included.

## Separate dependency finding

The GitHub push reported [Dependabot alert 25](https://github.com/randycodex/buildingcode/security/dependabot/25), an open medium-severity `@tiptap/core` runtime dependency advisory concerning `mergeAttributes()` handling of an own `__proto__` key; the advisory lists `3.30.4` as the first patched version. Dependency manifests were not changed by this Research release. This finding is retained for a separate scoped security review/update; this release does not claim to close it or establish exploitability in Permitext.
