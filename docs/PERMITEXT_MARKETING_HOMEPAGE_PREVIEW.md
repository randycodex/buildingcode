# Permitext marketing homepage preview

Status: local draft for owner review. No remote push, deployment, DNS change, paid service, analytics enablement, or iOS app change.

## Experience

- `/` serves the separate `public/home.html` marketing document.
- `/workspace` serves the existing workspace shell, `public/index.html`.
- `/web`, `/web/`, and `/workspace/` permanently redirect to `/workspace`, preserving query parameters. Browser redirects preserve fragments.
- `/web/*` remains the existing asset namespace. Shared `/open/section/*` links still serve the workspace.
- Marketing CSS and JavaScript are isolated under `public/marketing/`; workspace UI and styles are unchanged.

The design draws on the supplied Mora, Vercel, and Runner references: generous spacing, fine rules, restrained type, an actual product screenshot, and concrete explanations. The primary action is “Explore Permitext,” linking to the workflow section. Mobile repeats this action in a bottom bar when the hero action leaves view.

The page introduces both web and iOS. The iOS graphic uses the existing Permitext app icon. It does not claim an App Store release or invent a download link. A public download URL and any native screenshots remain owner-review items. No demo service, trial, customer endorsement, or contact address was invented.

The workspace screenshot was captured from an anonymous local session reading the Building Code and searching for “means of egress.” It contains no account or project data.

## Continuity

The manifest retains the installed app identity `/` and changes its start URL to `/workspace`. Homepage JavaScript sends standalone launches and known legacy workspace query/hash links to `/workspace` without reading or altering workspace storage. It checks for updates only on an existing service-worker registration; it does not install offline access for marketing visitors.

The worker caches homepage and workspace HTML separately, so homepage requests cannot overwrite the offline workspace fallback. Existing downloaded code caches are retained. The shell generation and versioned imports advance together. Billing portal and purchase-confirmation return links point to `/workspace`.

## Local review

From `permitext-sync-server`, with dependencies available:

```sh
PORT=8794 PERMITEXT_SYNC_DATA_PATH=/tmp/permitext-marketing-preview-store.json node server.mjs
```

Open `http://localhost:8794/`. This uses a separate local data file. The original checkout and production site remain unchanged.

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

These unrelated tests were not weakened or modified. Browser logs showed an unrelated wallet-extension `ethereum` injection error; no homepage application error was observed. Authenticated purchasing, physical-device iOS behavior, deployed Vercel routing, and an actual installed-PWA upgrade were not exercised. Production publication remains a separate step after owner review.
