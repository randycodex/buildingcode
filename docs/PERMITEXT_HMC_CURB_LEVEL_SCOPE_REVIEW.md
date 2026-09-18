# HMC Curb level — completed bounded scope review, September 17, 2026

**Disposition: retain the existing entry withheld.** Every exact singular/plural application occurrence in the five bundled HMC chapters carries local measurement instructions. This completes the applicability review of the current corpus; it does not activate a generic popup or create a new composite definition. This later complete inventory supersedes the preliminary Curb level item in the contextual review.

The existing resolved entry is `cbfaf13dd62d2ce15969`, from §27-2004(a)(36), `2026-enacted-administrative-code/chapters/30000077.html#section-31001849`. Its entire source-extracted wording, source identity and empty aliases are unchanged. Full body SHA-256: `3695949e96b45a0ad6a1e0f0ae884c5229d34d621e47f11c30fb56eaac735c4e`.

The general definition expressly begins “Except as otherwise provided” and describes the center of a building's front, an average across fronts on more than one street, and an alternative when no curb elevation has been established. The application sections specify measurement directly in front of each part of the room ceiling and on the street on which the dwelling fronts. Attaching only the general center/average wording would fail to present those local qualifications. Keeping these occurrences unlinked preserves the actual measurement text the reader is reading. This is an application-linking disposition for the bundled text, not a new official interpretation or a claim that the general definition has no purpose elsewhere.

| Source context | Exact occurrences | Disposition |
| --- | ---: | --- |
| §27-2004(a)(36), Curb level definition | 4 | Definition prose; never add definition links within it |
| §27-2004(a)(37), Cellar definition | 1 | Definition prose |
| §27-2004(a)(38), Basement definition | 2 | Definition prose |
| §27-2083(b), directly in front of each part | 1 | Withheld; local measurement instructions |
| §27-2083(b)(2), fronting street | 1 | Withheld; local measurement instructions |
| §27-2085(b), directly in front of each part | 1 | Withheld; local measurement instructions |
| §27-2085(b)(2), fronting street | 1 | Withheld; local measurement instructions |

Total: **11 exact occurrences, 7 in definitions and 4 in application paragraphs; zero plural occurrences**. There are no application occurrences in the other three chapters. Full §§27-2083 and 27-2085 were reviewed, including their occupancy conditions and surrounding subdivisions. No inferred synonym such as “curb elevation” was added. A future contextual definition presentation would require its own complete source-bound wording and rendered acceptance; it is not silently represented as implemented by this review.

## Reproducible evidence

Run from the repository root:

```sh
node permitext-sync-server/scripts/audit-hmc-curb-level-applicability.mjs /tmp/permitext-hmc-curb-level-audit.json
node --test permitext-sync-server/tests/hmc-curb-level-scope-audit.mjs
```

The repository-owned audit guards all five authored source hashes, re-extracts the complete definition, classifies every exact singular/plural paragraph range, and records original paragraphs, section anchors, zero-based paragraph indices, UTF-16 ranges, per-paragraph and source hashes. It exercises the current full registry selector/matcher for all actual ranges and confirms **zero Curb level links**. It fails on changed source bytes, definition body/source identity, aliases, reviewed scope or activation metadata.

All **4 focused tests passed**. These include rejection tests for drift in each of the five source chapters and mutated body, source edition, alias and activation metadata. The audit writes only a requested external evidence report; product registries and authored text were not modified. This is source/matcher verification, not a new browser, physical phone, deployment or TestFlight acceptance claim. Other HMC meanings, Title 26/Local Law coverage, and the ten deferred unresolved source entries are outside this review.
