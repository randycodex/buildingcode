# UX-11: repeated Notebook save failure and recovery

Status: bounded local rendered and HTTP acceptance passed. No product-code change was needed.

## Bounded scenario

Use a loopback-only synthetic populated account. Intercept a bounded series of Notebook save requests before the real handler. Keep reads available so this tests pending writes rather than an entirely offline product.

1. Open an existing populated Project Note and confirm its server content.
2. Arm repeated save failures, edit the Note, and confirm the UI distinguishes the device draft from server synchronization.
3. Make a later edit during the failure period and reload. Verify the latest draft remains visible; do not claim it has reached the server.
4. Restore successful writes and trigger the supported recovery path. Confirm the latest content through the real HTTP read and reload, with no duplicate card or stale conflict/error state.
5. Record failure attempts and unchanged server content during the outage. Preserve fixture accounts separately from all owner data.

This does not establish sustained total-network outage behavior, large-image recovery, native acceptance or production reliability. No new offline Report feature or collaboration surface is in scope.

## Observed result

The temporary small fixture on port 8806 contained 12 saves, 2 projects and 4 Notes. Existing Synthetic Note 4 started at server version 1 with the original synthetic paragraph. The fixture rejected Notebook saves before the application handler; it permitted reads and unrelated workspace operations.

- First edit: one HTTP503; server GET still returned version1 and the original paragraph.
- Second edit: second HTTP503; latest text was “Repeated save outage: latest second edit must survive reload.”
- Reload during the failure: third HTTP503; editor restored the latest text and accessible workspace status remained “Changes pending · 1”.
- Cleared the bounded failure control and reloaded: two queued successful saves (submitted version and newer draft) completed. Server GET returned version3 with the exact latest text; list remained four cards. UI reported Synced with no stale conflict or pending indicator.

[Recovered Note screenshot](UX_11_NOTEBOOK_SAVE_RECOVERY_2026-09-28.png).

The fixture now supports capability-protected `fail:true` for `/notebook/cards/save` with `uses:1–20`; `uses:0` clears it. Existing read controls remain one-shot. Metrics expose remaining failures and HTTP save outcomes without account tokens. The fixture's `--self-test-outage true` mode passes validation/capability checks, three rejections with unchanged server content, successful recovery/idempotent retry, and existing one-shot read behavior. Existing web Notebook durability contracts pass.

This closes repeated save-rejection recovery for the bounded local desktop workflow, not the entire extended-outage or resource-stress matrix. Native, full-network loss, large-image stress and production remain separate.
