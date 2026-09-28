# Hosted preview HTTP acceptance — September 28, 2026

Source: `8170f9ae3fb6cc191aa95c2eb1c246737e9d5c03`
Deployment: `dpl_J1vbP86GSNYJBk2S9CWKgzkq4Lmm`
Immutable URL: https://permitext-sync-icbvbo1y1-randycodexs-projects-b72fc111.vercel.app

Cookie-aware redirect handling resolved deployment authentication. No protection setting changed. Temporary access parameters and cookies were neither persisted in this record nor committed.

## Passed

Each representation returned200 with a nonempty corpus revision and an ETag equal to the quoted SHA256 of the exact response bytes. Unpinned responses require revalidation. Conditional requests returned304 with zero body bytes. Matching contentRevision pins preserved bytes and returned one-year immutable caching. Incorrect contentRevision and expectedPublicCorpusRevision each returned409 with no-store.

| Representation | Bytes |
|---|---:|
| `/code/revision` | 186 |
| `/code/libraries` | 24066 |
| `/code/chapters?view=startup` | 111468 |
| `/code/chapters/4?bodyContract=2` | 196380 |
| `/code/chapters/4?include=body&bodyContract=2&bodyStart=0&bodyLimit=2` | 3739 |
| `/code/sections/resolve?include=metadata&code=BC&version=CodeContent%2Fauthored%2Fnew-york-city%2F2022-construction-codes%2Fbundle.json%231&sectionNumber=403.2.3.3` | 744 |

Corpus revision: `74cf7e4d33fd04840809ef8f49fd5c5043db1aeee2ed0329068b332dcdcf7848`.

## Limits and next checks

All recorded initial responses reported Vercel cache MISS. This verifies hosted application HTTP behavior, not CDN hit rate, speed, Production, browser cache rollout, or iOS distribution. The hosted asset revision matches the generated manifest; one pinned PNG matches its byte count and SHA256 and returns immutable caching. Wrong, empty and duplicate asset pins are rejected uncached; invalid section IDs, a missing chapter and oversized Search query are uncached errors without ETags. Empty unauthenticated POST requests to sync/pull and projects/foundation/state return400/no-store without ETags. These rejection checks do not establish successful authenticated private-response behavior; that requires an authorized fixture account. Browser rollout and authenticated private-response acceptance remain open. No synthetic sign-in or account mutation was performed. Raw sanitized results are committed alongside this report.

## Browser guest-entry check

On READY deployment `dpl_Hfc4mxD7bAxpvGZbw3Lix8ZN4Uub`, source `184b7ff4996e0ff5af9a63f9c813868b857b1ae0` (documentation-only changes after8170), a fresh in-app-browser guest session mounted the Reader loading shell immediately after Explore Permitext. It then rendered Building Code2022 Chapter1, headings101.1–101.4.1 and incremental status5 of107 sections loaded. No error/warning console entries were captured. This proves the bounded guest journey, not cache invalidation across content versions or a latency benchmark.

Earlier on8170, guest-entry and Reader clicks left the welcome visible; reload restored the persisted Reader and rendered Chapter1 (17 of107 sections loaded). Keyboard focus worked. A bounded source review found no definite cause, and the fresh equivalent deployment did not reproduce it. Retain as an unresolved observation; no speculative patch. The browser controls and public content route work after reload.

## Follow-up performance fix — Reader insertion

Source review found +Reader awaited the first chapter catalog before inserting a panel. The handler now reserves the Reader slot and mounts through the existing independent hydration path immediately; populateReaderSelectors resolves the omitted chapter with its existing cancellation/identity handling. Default Building2022 and guest two-Reader limit remain. Concurrent clicks previously could all pass the limit before the catalog resolved. The new production-handler regression covers unresolved catalog/render work and guest/Pro repeated clicks. App/shell versions advance to v583/v1226. This is not claimed to fix the unreproduced welcome observation.

Focused Reader insertion and workspace pane orchestration contracts pass. Agent also verified startup critical-path and shell-cache contracts. The existing reader-navigation-race contract fails on both untouched HEAD and this change at line145 (missing expected chapter fixture); it is not counted as passing. Hosted verification of this new change remains pending.

The navigation-race fixture failure is now resolved: its isolated VM omitted account identity, workspace, connected-panel and active-source preflight dependencies introduced by source controls. The fixture now supplies them and explicitly waits for authorization before racing chapter metadata. Production navigation code is unchanged. Reader navigation race and actual active-source navigation contracts both pass, retaining stale-response, cancellation and explicit-enable coverage.
