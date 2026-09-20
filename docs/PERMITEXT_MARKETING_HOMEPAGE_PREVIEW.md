# Permitext marketing homepage preview

Status as of September 19, 2026: the owner selected the three-column homepage. Production routing at commit `0c8a9e41c` is verified: `/` serves marketing, `/workspace` and `/open/section/*` serve the app. Build 91 completed Apple processing, is assigned to Internal Testers, and was installed and opened on the owner's iPhone. Real iOS Reader and Search captures are included. Video remains on hold. No DNS change, paid Research run, or analytics enablement.

## Experience

- `/` serves the separate `public/home.html` marketing document.
- `/workspace` serves the existing workspace shell, `public/index.html`.
- `/web`, `/web/`, and `/workspace/` permanently redirect to `/workspace`, preserving query parameters. Browser redirects preserve fragments.
- `/web/*` remains the existing asset namespace. Shared `/open/section/*` links still serve the workspace.
- Marketing CSS and JavaScript are isolated under `public/marketing/`; workspace UI and styles are unchanged.

The design draws on the supplied Mora, Vercel, and Runner references: generous spacing, fine rules, restrained type, an actual product screenshot, and concrete explanations. Desktop and tablet use “Open Workspace,” linking to `/workspace`. Phones use “Explore Permitext,” linking to the workflow section, with a matching sticky action after the hero leaves view.

The page introduces both web and iOS. The iOS graphic uses the existing Permitext app icon. It does not claim an App Store release or invent a download link. The existing public TestFlight invitation was verified as not accepting new testers, so no public join CTA is advertised. Native Reader and Search screenshots were captured from the installed build 91. No demo service, trial, customer endorsement, or contact address was invented.

The workspace screenshot was captured from an anonymous local session reading the Building Code and searching for “means of egress.” It contains no account or project data.

## Continuity

The manifest retains the installed app identity `/` and changes its start URL to `/workspace`. Homepage JavaScript sends standalone launches and known legacy workspace query/hash links to `/workspace` without reading or altering workspace storage. It checks for updates only on an existing service-worker registration; it does not install offline access for marketing visitors.

The worker caches homepage and workspace HTML separately, so homepage requests cannot overwrite the offline workspace fallback. Existing downloaded code caches are retained. The shell generation and versioned imports advance together. Billing portal and purchase-confirmation return links point to `/workspace`.

## Local review

From `permitext-sync-server`, with dependencies available:

```sh
PORT=8794 PERMITEXT_SYNC_DATA_PATH=/tmp/permitext-marketing-preview-store.json node server.mjs
```

Open `http://localhost:8794/`. This uses a separate local data file. This preview uses the marketing worktree; production status must be verified separately.

## Verification

Passed:

- `npm run test:routing`: Vercel route contracts plus live local HTTP checks for homepage/workspace separation, legacy redirects, shared section links, assets, anchor targets, and installed-app/legacy callback entry.
- `npm run test:offline`: independent homepage/workspace fallbacks under server failure and network loss, manifest identity, and existing offline installation/recovery tests.
- `node tests/web-launch-surface-contract.mjs`.
- `node tests/billing-contract.mjs`.
- Syntax checks and `git diff --check`.
- Rendered browser checks at 320, 390, 768, and 1440 CSS pixels. No horizontal overflow; hero CTA fits above the fold at the checked phone sizes. Mobile sticky CTA and iOS FAQ link work.
- The local Reader and Search columns, including the existing search query, restore at `/workspace`. No marketing stylesheet loads in the workspace.

Existing failures reproduced on the unchanged original checkout at base commit `0717d4ff1`:

- `beta1-public-surface-contract.mjs` expects obsolete iOS `Text("Current plan")` copy.
- `build-output-contract.mjs` fails its existing Notebook private-image bundle assertion.

These unrelated tests were not weakened or modified. Browser logs showed an unrelated wallet-extension `ethereum` injection error; no homepage application error was observed. Authenticated purchasing, physical-device iOS behavior, deployed Vercel routing, and an actual installed-PWA upgrade were not exercised. The owner has now selected the three-column version for publication; see the current status above.


## Preserved alternatives and current layout

- `/` is the selected three-column homepage with canonical and social metadata.
- `/homepage-original` preserves Version A as a noindex preview.
- `/homepage-columns` preserves the earlier column study.
- `/homepage-columns-three` remains a noindex preview of the selected design.
- Desktop uses aligned introduction, walkthrough, and web/iOS columns with one document scroll, pinned column labels, and hidden scrollbars. The wide screenshot experiment was reverted.
- The workspace image can expand into a closeable dialog; no video was added.
- Real Reader, Search, Saved, and Research captures illustrate the workflow. Research uses an existing historical-code answer with scope and missing-evidence controls; its citation was opened and checked. No new paid query was submitted.
- The temporary web bookmark was removed and the signed-in Chrome workspace returned to its initial empty-panel state.
- Physical build-91 Reader and Search captures are complete. The temporary query was cleared; no saved items or account settings were changed.
- Vercel static files take priority over the root rewrite. The deployment build now copies the unchanged workspace shell to `workspace.html` and writes the selected homepage to the generated `index.html`. Source `public/index.html` remains the app. The build contract tests this separation.

## Separate iOS finding

During build-91 capture, the Search quick preview for 2022 BC 107.5 showed its Chapter 10 reference labeled “Traps, Interceptors and Separators.” The 2014 preview similarly showed a mechanical-code chapter label. This is an observed reference-resolution or labeling defect, not a verified root cause. No misleading quick-preview screenshot is used in the homepage. Direct navigation through the 2022 Building Code Reader correctly opens Chapter 10: Means of Egress. This native defect remains outside the marketing change and needs its own fix.
