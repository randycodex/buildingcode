# Preview deployment acceptance — September 25, 2026

## Verified

- Draft PR: https://github.com/randycodex/buildingcode/pull/67
- Source: `776682df13c18b6f39ffade269c5c1337962e184`, branch `codex/permitext-performance`.
- Vercel deployment: `dpl_4vSMHoqWJ7b7K4KsysgVPCQ2tZwg`.
- Immutable deployment URL: https://permitext-sync-1gjr2h058-randycodexs-projects-b72fc111.vercel.app
- Vercel deployment API reports READY and the exact source SHA above. GitHub Vercel check reports SUCCESS.
- This is a preview; no main merge, Production promotion, or iOS distribution occurred.

## Incomplete HTTP acceptance

At approximately 05:16–05:17 UTC, GET `/code/revision` returned HTTP 302 to Vercel SSO from the branch alias. The Vercel authenticated fetch connector also returned HTTP 302 from both the alias and immutable deployment URL. These responses came from deployment protection, not the application. Their `no-store` headers do not establish the public content cache contract.

No authentication settings were weakened. Temporary share parameters and cookies are intentionally excluded from this record. Further identical access retries are not warranted.

Once authenticated preview access is available, verify `/code/revision`, `/code/libraries`, chapter metadata and bounded body windows: exact-byte ETags; empty conditional 304; matching immutable representation pins; uncached 409 for incorrect representation/corpus pins; asset revision matching the deployed manifest. Use the local public-code-cache HTTP contract as the expected behavior. Do not run its synthetic sign-in operations against a hosted account.

Build acceptance passes. Hosted content/cache acceptance remains open; this is not a CDN latency or hit-rate measurement.
