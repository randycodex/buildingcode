# Permitext

Permitext is a local-first NYC code-research workspace for iPhone and web. It
helps users research NYC code requirements and preserve the selected evidence
behind project decisions. Search finds candidate material; Research works only
from user-selected enacted passages and returns citations, uncertainty, missing
facts, and limitations rather than an approval or official determination.

## Workspace map

- `NYC CC APP/` — the SwiftUI iPhone app. Open `NYC CC APP/NYC CC APP.xcodeproj`
  and use the `permitext` scheme.
- `permitext-sync-server/` — the Vercel/Node backend and web workspace. This is
  the source of truth for deployed server behavior; see its
  [README](permitext-sync-server/README.md).
- `NYC CC APP/permitext/Resources/CodeContent/` — the published Construction
  Code and Zoning Resolution content, prepared bodies, search index, and assets.
- `PERMITEXT_BUG_AUDIT.md` — current implementation findings, validation state,
  and remaining hardening work.

## Local verification

Run backend checks from the server directory:

```sh
cd permitext-sync-server
npm run check
npm run smoke
```

`npm run smoke` uses the JSON-file development adapter. PostgreSQL verification
requires a configured database URL and is deliberately separate:

```sh
PERMITEXT_SYNC_DATABASE_URL="$DATABASE_URL" npm run verify:postgres
```

Run the content gate after changing published code content or search data:

```sh
cd permitext-sync-server
npm run verify:content
```

For iPhone build and runtime notes, see
[`NYC CC APP/IOS_APP_CONTEXT.md`](NYC%20CC%20APP/IOS_APP_CONTEXT.md). Verify
implementation claims against the current source and tests.
