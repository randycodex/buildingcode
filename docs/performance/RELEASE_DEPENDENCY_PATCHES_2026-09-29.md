# Candidate dependency patches — September29

GitHub open alerts27/28 identified Tiptap core3.30.4 (GHSA-j95f-988m-3j2f, Markdown attribute parsing denial of service) and Undici6.28.0 (WebSocket decompression error handling). Candidate overrides now align all Tiptap packages at3.30.5 and Undici at6.28.1. The generated Notebook bundle was rebuilt. Web614/shell1257/Notebook19 invalidate affected assets together.

Validation: dependency gate exercises installed CommonJS and browser ESM builds, including patched attribute-boundary behavior and existing prototype/DOM-attribute safety; Notebook build, shell-cache contract, build-output contract and full npm run smoke pass. Smoke log: /tmp/permitext-security-614-smoke.log. npm audit --omit=dev reports zero vulnerabilities at this checkpoint; this is registry audit coverage, not proof of universal security.

Actual generated Notebook editor rendered in the local-only smoke fixture. A synthetic heading edit emitted one change; serialization and Reload snapshot retained the edit, canonical reference8881, bold/italic text and lists. Screenshot: /tmp/permitext-notebook-security-614.png. No account or backend records were used. Fixture tab/server closed afterward. This is bounded editor acceptance, not authenticated hosted acceptance.

Full npm audit still reports development-only @vercel/routing-utils6.5.0/path-to-regexp6.1.0. Only tests/web-shell-cache-contract.mjs imports routing-utils. It intentionally compares its original compiler with a6.3.0 alias; overriding it would change the Vercel parity test. No forced downgrade or unreviewed override applied. Revisit with an upstream routing-utils release.

Production remains unchanged; candidate hosted asset identity and real authenticated staging acceptance remain open for web614. Native41.35 is unaffected by these web dependency changes.
