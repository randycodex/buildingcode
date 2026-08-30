# Permitext Production policy-publication audit — August 30, 2026

## Outcome

The three canonical policy URLs respond directly with HTTP 200 HTML, but none currently serves the exact owner-approved August 28 document. Production policy publication therefore remains **not ready**.

| Document | Approved version | Approved/local SHA-256 | Live Production SHA-256 | Result |
| --- | --- | --- | --- | --- |
| Terms | `terms-2026-08-28` | `d15a253fd0886e9f091d0e76dfbba8ce0aa922ff57d7c84b66ab37c8d1fa8abc` | `e36975b14089e4d47e174da24e2e2161cd06c757a5719663120100598bece104` | Stale/different |
| Privacy Policy | `privacy-2026-08-28` | `ab2a135482fe22bd02136672c37da2821fb2df5add866e02928ae284d7fdddef` | `9d83bc99cef1f538f3c4e9be4a9d783dbac894202e805b83f6160761fb5409a6` | Stale/different |
| Subscription and Refund Policy | `subscriptions-2026-08-28` | `4e830128ba659d6074b975d8ea693ac5a4e687c80102531a8bbef422abd6ebc7` | `0471b71bc2e50eb3fe41bc82729db882e79593bd8f363b9dcdcae88d5af12e5f` | Stale/different |

The live fetch ran at approximately 12:10 AM EDT against:

- `https://permitext.com/terms`
- `https://permitext.com/privacy`
- `https://permitext.com/refunds`

Each route returned directly with HTTP 200 and `text/html; charset=utf-8`. The failure is exact approved-content publication, not URL reachability.

## Permanent fail-closed guard

`permitext-sync-server/policy-publication-audit.mjs` compares the checked-in approved hash, the actual local file hash, and the fetched Production body hash. It also requires a canonical HTTPS origin, direct HTTP 200 response, and HTML content type. The report emits only versions, routes, checks, status/content-type metadata, and hashes; it does not emit policy bodies or customer identifiers.

Run from `permitext-sync-server`:

```sh
npm run audit:policy-publication
npm run audit:policy-publication -- --require-live
```

The first command provides a read-only report. The second exits nonzero unless every approved document is published exactly. On this audit, it correctly exited `1` with `publicationReady: false`.

The contract also rejects stale bodies, redirects, non-HTML responses, network failures, local approved-file drift, and noncanonical or non-HTTPS base URLs.

## Remaining gate

No deployment, Production configuration, pricing, or paid provider action occurred. The open launch sequence must deploy the intended release separately, rerun the strict live audit until it returns `publicationReady: true`, visually verify the purchase screens against the published documents, and only then configure and activate the three approved current-version identifiers.
