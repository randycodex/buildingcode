# September29 candidate integration checkpoint

> **Owner scope update — September29:** All remaining accessibility tasks are deferred for now, including VoiceOver, Dynamic Type and broader assistive-technology checks on web/iOS. They are unverified backlog, not current release prerequisites. Preserve completed fixes and evidence. This update supersedes older accessibility requirements below until the owner resumes them.

## Current checkpoint — supersedes historical evidence below

- Native source9813ea541 built as signed Release41.35, installed and physically verified for remembered Reader labels after process restart. See RELEASE_41_35_BUILD.json. Earlier41.34 checks close chapter-top/ordinary bookmark targeting, Project assignment receipt, Note edit/revert, bounded background returns, offline read/reconnect and saved-work readback after process termination. These do not certify interrupted unsaved writes or sustained-use coverage.
- Current web runtime is web614/shell1257/Notebook19 at source04e8f59b9, including patched Tiptap/Undici dependencies. Seven exact hosted assets/headers are verified in PERF_PREVIEW_614_IDENTITY_2026-09-29.json. Full local smoke and rebuilt editor round-trip pass. The same candidate is now deployed to the isolated apple-sandbox environment at `permitext-apple-sandbox.vercel.app`; seven exact assets/headers pass in RELEASE_SANDBOX_614_IDENTITY_2026-09-29.json. Authenticated candidate journey now passes at staging.permitext.com: normal sign-in, authorized staging Pro, Project/Note/Saved creation and reload, fresh server readback and no-store/MISS private responses. See RELEASE_STAGING_PRIVATE_READBACK_2026-09-29.json. See RELEASE_STAGING_AUTH_SETUP_2026-09-29.md.
- Owner deferred all remaining accessibility acceptance, including VoiceOver and Dynamic Type; no phone preference was changed.
- Draft PR69 remains open and mergeable. Current local work is on codex/reader-save-target; main merge, Production promotion and TestFlight distribution have not been performed for this candidate.
- Next prerequisites: complete the remaining specifically scoped interruption acceptance, identify the intended TestFlight artifact, then obtain owner release approval. Speed tuning remains paused.

## Historical checkpoint — web608

Runtime source:07cc2ac5e (web608/shell1251/Notebook18), with the build-output test’s descriptive Notebook version pattern corrected. The earlier failure required the literal feature word “reference”; it did not identify missing upload/resolve behavior. Those assertions remain unchanged.

- Full `npm run smoke` passed, including its client-build/security prerequisites and configured source/sync/Notebook/Report/Research/HTTP checks. Log:`/tmp/permitext-release-608-smoke.log`. This suite is local acceptance, not physical or Production acceptance.
- The recorded41.34 executable and current Reader source SHA-256 both still match `RELEASE_41_34_BUILD.json`. No new native rebuild was needed for subsequent web/docs/test-only changes.41.34 remains uninstalled.
- GitHub reports Vercel success for exact source07cc2ac5e, deployment `dpl_3BWezsyspzUBsWhgzVbHmTCLS8aw` at `https://permitext-sync-p0qowsn05-randycodexs-projects-b72fc111.vercel.app`. This is deployment readiness, not hosted byte/rendered acceptance. Production remains separately evidenced at main0c729b7d1.
- Draft PR69 description now covers both actual changes: native save targeting and web Notebook accessibility, plus the bounded recovery evidence.

## Remaining merge/release evidence — current September29

1. Authenticated staging gate closed for the bounded Project/Note/Saved journey and fresh private server responses. Preserve the evidence; repeat only after a relevant runtime/configuration change.
2. Finish physical sustained-use, process interruption during an unacknowledged write ; native accessibility is owner-deferred. Bounded offline Note edit/reopen/reconnect now passes on41.35; see the cross-device acceptance record. Larger text is owner-deferred. Previously passed bookmark targeting, Project assignment receipt and Note edit/revert remain closed.
3. Identify and verify the intended TestFlight artifact; the installed development-signed41.35 is not distribution acceptance.
4. Obtain owner authorization for the next main merge/release action. No merge, Production promotion or TestFlight distribution was performed for this candidate.

Local recovery success does not close image-upload interruption or every account/assistive-technology variant. Keep the first-release checklist and full plan scopes intact.

## Exact hosted identity — completed

Preview `dpl_Fhz49NCk47YRuZ748DWJ9Z7Y5abP` is READY for `c0e0ed73c14f01cea24ce5c6d6266bf568088f5d`. Six responses (workspace HTML, app.js, offline-storage.js, service-worker.js, Notebook JS and CSS) returned200 and match the local candidate byte-for-byte. HTML revalidates, versioned assets are immutable, and the worker is no-cache. See [hash/header evidence](PERF_PREVIEW_608_IDENTITY_2026-09-29.json).

Temporary protected-preview access used an in-memory cookie session; no access URL/cookie is stored in the artifact. This closes exact hosted asset identity for web608/shell1251/Notebook18. Application-authenticated preview editing and physical/native/distribution acceptance remain open. Production was unchanged. Subsequent evidence-only commits do not change these verified runtime bytes.
