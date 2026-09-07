# Web shell cache repair

Original audit B4 startup measurement exposed a release-update defect. Status:
**local suites, Chrome lifecycle and hosted core-header checks passed;
publication pending**. This joins the Reader repair in PR #62. It does not change the public
Beta gate or installed iOS build 62.

## Observed failure

At `2026-09-07T04:01:53.726Z`, a Chrome Performance reload captured the existing
Production workspace. Its actual script element still referenced
`20260906-offline-install-recovery-v50`. Fresh network source and `/health`
identified deployed commit `aed30262742d1888f94555997c4140cbdcaa7b71` and v52.
The trace's main HTML response had `fromCache: true`,
`fromServiceWorker: false`, and:

```
Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable
```

The blanket `/web/:path*` header applied the asset cache policy to `/web` HTML.
The browser could therefore keep loading an older release after deployment.
This qualifies earlier statements that a retained browser's ordinary reload
proved the newly deployed client: health and fresh network source binding were
verified, but that alone did not identify its actual executing script version.
Existing backend receipts and scoped UI observations retain their evidence;
their release attribution must not be expanded from a separate health call.

The diagnostic device was a MacBook Air M1 with 16 GB, macOS 26.6.2 and Chrome
152.0.7977.77, with an observed 1125 × 823 CSS-pixel viewport and existing
extensions. A leftover DevTools network-delay profile was found and restored to
No throttling before recording. Disable cache was unchecked. The single trace
reported LCP 1.05 s and CLS 0, but ran v50: **it is excluded from current-release
startup acceptance, and no p50/p90 is claimed**.

## Repair

- Public HTML and unversioned web resources revalidate with
  `public, max-age=0, must-revalidate`. HTML stays revalidated even when its URL
  has a version or authentication-return query. Local top-level HTML retains
  its stronger existing `no-store` behavior.
- Only static JS/CSS/font/image/manifest URLs with a nonempty `v` query receive
  the one-year immutable policy. Private account and Notebook routes are outside
  the rule. The service-worker script remains `no-cache`.
- Service-worker network-first navigation explicitly uses `cache: "no-cache"`
  to revalidate older HTTP entries. Its CacheStorage fallback for network failure
  and server errors remains intact.
- Shell assets advance together to `20260907-shell-revalidation-v55` and
  `permitext-pro-shell-v794`, including the previously tested Reader repair.

The route/query configuration follows [Vercel's header configuration](https://vercel.com/docs/project-configuration/vercel-json#headers)
and [Cache-Control behavior](https://vercel.com/docs/caching/cache-control-headers).

## Verification

`web-shell-cache-contract.mjs` compiles the real configuration with the pinned
Vercel routing compiler, then covers HTML aliases/queries, versioned and
unversioned static assets, the worker and private-route exclusions. It also
starts the actual application HTTP handler and checks the response headers.
The test runs in `npm run check`. The offline contract executes the real worker
handler against a simulated older immutable HTTP shell, verifies current shell
selection, and retains the cached fallback on a 503 response.

A separate Chrome fixture used the compiled candidate headers on an isolated
loopback origin. Ordinary link navigation with caching enabled showed:

| Server release | Previous immutable HTML policy | Repaired policy |
| --- | --- | --- |
| 1 | HTML 1 / script 1 | HTML 1 / script 1 |
| 2 | Still HTML 1 / script 1 | HTML 2 / script 2 |
| 2, repeated navigation | Not repeated | HTML 2 / script 2 |
| 3 | Not repeated | HTML 3 / script 3 |

Server request receipts confirm the old HTML was requested once, repaired HTML
was requested for every navigation, and each versioned script was requested
only once. This verifies browser cache behavior using the real compiled rules;
it is not a hosted Vercel receipt or a new complete-app Reader run. The existing
v54 complete-app Reader evidence remains separately recorded.

Private diagnostic trace, request receipts and check logs are under
`/private/tmp/permitext-startup-b4-20260907/`. Raw traces are not committed.
No account grant, paid Research, phone action or private-data cleanup was used.
The temporary loopback server stopped, its tab closed, and Production DevTools
closed. The retained Permitext session remains signed in.

`npm run check`, including its precheck and postcheck, passed. The first smoke
run caught an obsolete test fetching unversioned `/web/app.js` while asserting
versioned caching. The corrected smoke fetches the script URL selected by the
actual HTML; the complete rerun passed. No application code changed after the
full check suite and browser cache lifecycle result.

Vercel preview `dpl_DtAu4cHynA74CxyBrpffjuwpgcEv` reached READY for source
`f4bfcf01b46eaa9a52fd4ac0c6732a5f69ccd209`. The protected preview redirects
both the connector's temporary access URL and Chrome to Vercel identity
verification; Vercel sign-in was requested and the owner completed it.

### Hosted preview acceptance

On September 7, the final smoke/evidence head
`eb001c9d1bb1e7ccb0b902b8e19676ece0f5cf29` had a READY preview:
`dpl_6KTniyAGBT2AK41brRPqfoiTnFW1`, hosted at
`permitext-sync-4qef48zbf-randycodexs-projects-b72fc111.vercel.app`.
GitHub's Vercel checks passed. The actual Chrome DOM selected the v55 app script
and stylesheet. With network/CPU throttling off and Disable cache unchecked,
a DevTools reload trace captured these HTTP 200 responses:

| Resource | Cache-Control | Browser cache used |
| --- | --- | --- |
| `/web` HTML | `public, max-age=0, must-revalidate` | No |
| v55 `app.js` | `public, max-age=31536000, s-maxage=31536000, immutable` | Yes |
| v55 `styles.css` | `public, max-age=31536000, s-maxage=31536000, immutable` | Yes |
| Unversioned Source Serif font | `public, max-age=0, must-revalidate` | No |

None came from a service worker. This confirms the platform's critical
HTML/versioned-asset/unversioned-asset distinction on the deployed candidate.
The page remained signed out of Permitext; its Production session was untouched.
The completed preview tab and DevTools were closed afterward.

The broad alias/query/private-route matrix remains compiled-config/local HTTP
evidence. The preview's version-looking HTML URL and trailing-slash shell opened,
but the additional trace was not exported after Chrome use resumed. Direct
navigation to `service-worker.js` was blocked by the browser client and is not
a hosted worker-header result. No attempt was made to bypass that restriction.
The unchanged worker-script header and revised navigation behavior are covered
by the local contracts. These observations do not constitute a new offline
installation, full Reader acceptance, authenticated preview journey or B4 timing
sample.

Private receipts: `pr62-final-preview-build.json`,
`pr62-preview-headers.json.gz` and `pr62-preview-response-headers.json` in the
same private evidence directory. The trace excludes resource bodies and source
maps. Only unrelated extension errors appeared in the bounded preview log read.

## Publication and remaining boundary

The combined candidate's local suites and hosted core headers now pass.
PR #62 needs approval for this final scope before Production; a documentation-only
evidence commit does not change the tested application/configuration bytes.
After publication, verify both actual script version and Reader positions in
the retained session before resuming B4's representative cold/warm samples.
An already stored one-year immutable entry may need one deliberate hard refresh
to obtain the revised headers. Do not clear site data or private drafts to do it.
No automatic refresh of an actively edited workspace is introduced.
