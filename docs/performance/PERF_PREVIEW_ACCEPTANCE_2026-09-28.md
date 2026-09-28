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
