# Permitext UX/UI first implementation checkpoint

## Isolation and scope

- Branch: `codex/uiux-hig`.
- Worktree: `/Users/randy/Documents/X_CODING/permitext-uiux`.
- Base: `6075b20ae2a36cfaeca87130eebc83dc527a942a`.
- Authorized scope: begin the web/iOS UX improvements following rendered inspection and review of [Apple's Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines).
- This checkpoint is local implementation and review evidence. It is not a merge, deployment, physical-device acceptance, TestFlight build, or App Store release.

## Implemented

### iPhone

- Visible labels for Saved, Reader 1, Reader 2, Search, and Research. Existing destinations and accessibility names remain intact.
- Project names use up to three full-width lines in standard Saved tiles. Accessibility text sizes use a vertical list with unrestricted name wrapping; the regular two-column pager remains available at standard sizes.
- Project detail headings wrap without a two-line cap, using a smaller semantic title style.
- Optional Project/Reference context is disclosed on demand. Project Hub presents existing work before empty categories, which are available under More Project details. Duplicate metric cards and the introductory paragraph were removed.
- Notebook navigation has a 44-point minimum height. New disclosure labels use the system text color for appearance contrast.
- Notebook dates accept both whole-second and fractional-second ISO timestamps, format them for the user, and show Date unavailable for invalid input.

### Web

- The returning empty workspace provides direct Open Reader, Search codes, and Saved & Projects actions through existing navigation handlers, with visible focus and 44px minimum targets.
- Workspace recovery notices occupy a row above the content instead of floating over it. Long notices wrap and have bounded scroll height.
- Saved Project names wrap instead of remaining a single ellipsized line.
- A genuinely empty Project/Reference has an explicit saved-evidence prompt distinct from a filtered view with no matches.
- Coordinated shell generation: `20260908-uiux-hig-v57`, cache `permitext-pro-shell-v796`.

Reader typography, code content, research answer generation/rendering, billing, permissions, and sync behavior are outside this checkpoint's changes.

## Validation

- `npm run check`: passed, including the repository's local Research, account isolation, Project, and UX contracts. No paid Research evaluation was run.
- `npm run test:ux-alignment`: all seven suites passed. The governance contract now checks the actual Reports section instead of requiring the removed duplicate Reports metric.
- `npm run test:offline`: offline contract and installer recovery passed.
- `npm run audit:ux-ui`: passed with one dynamic-button review reminder. The entry buttons were checked for accessible names, keyboard activation, visible focus, and target size.
- Swift Foundation check against the extracted Notebook date formatter: fractional and whole-second timestamps produce the same abbreviated date; malformed timestamps do not leak raw input.
- Xcode Debug iOS Simulator build: passed using Xcode 27 beta 6 with isolated DerivedData under `/private/tmp/permitext-uiux-qa`.

### Rendered coverage and limits

- Actual isolated web app at `http://localhost:8794/`: returning-workspace actions, Reader/Search/Saved entry, keyboard navigation, focus, and recovery notice spacing. Browser console error list was empty. Notice bottom and workspace top matched in DOM geometry.
- Web appearance fixtures under `/private/tmp/permitext-uiux-qa/web-appearance` use the current stylesheet with forced light/dark media conditions. Checked controls and long Project names at desktop and 390px widths. This is CSS coverage; authenticated web Project data and the full light-mode application flow were not exercised.
- Dedicated simulator: Permitext UIUX Review, iPhone 17 Pro, iOS 26.5. Used the existing local entitled fixture with Clerk disabled; no production account data was used.
- Native light/dark review covered tab labels, a long Project title, Saved tiles, Project context, and expanded More Project details. Text Size 8 confirmed the accessibility list and full heading wrapping; standard Text Size 3 was restored.
- Native fixture Project Hub data is empty. Populated Notebook/Research/Report states still need user acceptance with representative data. VoiceOver and physical-device acceptance remain open.

## Follow-up and merge notes

1. Review this visual checkpoint with Randy before expanding the redesign.
2. Coordinate the Research context/composer/disclosure changes after the separate Research-results work settles. Search edition clarity remains in the backlog.
3. Before merging, compare with current main and reconcile any overlapping `public/app.js`, `public/styles.css`, `PermitextApp.swift`, and cache-generation changes. Isolation prevents working-directory collisions but cannot eliminate later merge conflicts.
4. Repeat the affected local checks and rendered acceptance on the combined branch before release.

Local setup uses a `node_modules` symlink to the original checkout's existing dependencies. It is not part of the commit. Temporary build logs, appearance fixtures, simulator data, and generated client assets are also excluded.

## Reader width correction and local Pro review

Following owner review, automatic Reader expansion now applies on every plan,
including source-linked Readers. A sole Reader fills the available workspace even
when an older custom width was saved. Multiple default-width Readers share the
remaining space until each reaches 600px, then the workspace scrolls horizontally.
Manual widths remain respected in multi-column layouts. Utility widths are unchanged.
The existing centered 800px maximum text width and typography remain unchanged.
Shell generation is now `20260908-reader-fill-v58`, cache `permitext-pro-shell-v797`.

Rendered at a 1864px workspace: one Reader measured about 1862px (excluding edge
handles), two about 931px each, three about 620px each, and four exactly 600px each.
The single Reader's text measured 800px. Returning to one Reader expanded it again;
no browser console errors were reported. A new executable Reader-width regression
contract covers plan independence, restored/source-linked Readers, minimum width,
manual sizing, utility behavior, and retention of the text-width CSS. UX alignment,
offline recovery, and UX audit checks passed. The full smoke suite also passed on
an isolated test server at port 8796, leaving the review preview available.

At the owner's request, the sole local Web browser account received a Pro grant
in `/private/tmp/permitext-uiux-qa/sync-store.json` through the local grant API.
The browser visibly shows PRO. This grants no production subscription and changes
no real billing. The preview launcher is temporary, binds to loopback, uses isolated
storage, and has no OpenAI key or Research mock mode enabled. Live AI Research is
not configured. No authorization bypass or grant credential is included in source.

## Saved controls and Account header follow-up

At owner request, Saved now groups Sort, Export, and Account in a Liquid Glass
capsule on iOS 26 and later, with a regular-material fallback on older supported
iOS versions. Icons use the existing Project toolbar size and each action has a
44-point target. The title row reserves enough height for the capsule. Empty
Saved collections omit Export from the group instead of leaving an invisible slot.
Account no longer draws the custom CodeTopContentFade overlay above its content.

Validation: Debug simulator build passed for arm64 and x86_64; UX alignment
contracts, UX audit, and git diff whitespace check passed. Device Hub repeatedly
returned accessibility timeouts or noWindowsAvailable, so post-change interaction,
Account appearance, and increased Dynamic Type verification remain pending. No
physical-device installation, production deployment, or App Store change is claimed.

## Retained browser workspace recovery follow-up

At owner request, dismissing or reviewing the legacy-workspace banner now records
its dismissal across reloads. This applies only to that notice; unrelated workspace
errors retain their existing behavior. A failed dismissal write stays visible with
a retry explanation. Original quarantined records remain intact.

Account > Data & Storage now has Review older workspace data above destructive
controls. The review reports retained/unreadable/missing records without exposing
private content. When the recorded owner and all embedded ownership identifiers
match the active account, Download recovery copy exports a credential-redacted
snapshot for manual review. It does not import, replay, sync, overwrite, or delete
anything; external images and server-only data are explicitly outside that copy.
Unverified ownership offers a content-free diagnostic download and support link.
Ownership is checked against the exact captured bytes that will be exported.

Focused verification passed: account isolation (including ownership mismatch,
missing owner, mixed owners, unreadable data, redaction, mutable-storage snapshot,
dismissal persistence and failed writes), account-mutation isolation, UX alignment,
UX audit and offline contracts. The browser showed three retained records with
unverified ownership, correctly withheld content export, retained access after
reload, and downloaded diagnostics through keyboard activation with a visible
focus outline. No browser console errors were observed. Rendered review used the
existing dark appearance; light appearance was not separately exercised. The
owner-matched export path was verified with synthetic in-memory records, not by
changing this browser's account or legacy data. No support message was sent.

Shell generation: 20260908-workspace-recovery-v62; cache: permitext-pro-shell-v801.
Local preview only; no main merge or production deployment.
