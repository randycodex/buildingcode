# Permitext Backend Source Of Truth

The deployed Permitext sync backend lives at:

```text
../../permitext-sync-server
```

Keep backend code changes in that root folder. Vercel is configured with `permitext-sync-server` as the project root directory, so a second copy under the iOS app can drift and ship stale behavior.
