# HMC Family applicability review

September 17, 2026. Read-only source audit and hypothetical matching only. Family remains `review-required` in product data. No registry generation, binding activation, app change or release is included.

## Source and complete inventory

Original ID `89e60949d0b76dbdfcfe` retains the complete Family definition in enacted HMC §27-2004(a)(4), source `2026-enacted-administrative-code/chapters/30000077.html#section-31001849`. The audit re-extracts the numbered definition and compares its full body and identity to the current registry, including all household alternatives, student/fire-safety qualifications and final common-household paragraph. It verifies the existing SHA-256 guards for all five HMC source chapters.

Every singular `family` and plural `families` paragraph range is recorded with the complete paragraph, source and paragraph hashes, section/anchor, paragraph index and UTF-16 offsets. There are 84 ranges, including 14 plurals: 25 ranges are in §27-2004 and 59 elsewhere. The older contextual review's 55 outside-definition occurrences counted singular labels only. The four additional outside-definition plurals are two in §27-2087, one in §27-2093.1 and one in §27-2089.

| Classification | Ranges | Disposition |
| --- | ---: | --- |
| §27-2004 definition prose | 25 | Always plain |
| §27-2087 section-qualified occupancy | 10 | Withheld: subdivision (c)(1) excludes boarders for the purposes of this section |
| Other declarations | 8 | Plain: §§27-2030, 27-2045, 27-2056.1 and 27-2093.1 |
| Family-member compounds | 5 | Withheld: local kinship meaning in §27-2097 and applications in §27-2098 |
| One-/two-/single-family dwelling compounds | 21 | Withheld: short Family link does not define the qualified building category |
| Tenant/owner kinship | 7 | Withheld: §§27-2006, 27-2013, 27-2017.12, 27-2056.15 and 27-2056.22 |
| Household candidates | 8 | Hypothetical scoped matches below |

The classifications describe this bounded proposal; withholding does not declare that a general meaning can never apply. No definitions are decorated inside definition chapters or embedded definition passages.

## Bounded proposal

| Section | Ranges | Application |
| --- | ---: | --- |
| §27-2076(b) | 2 | Household occupancy of a rooming unit |
| §27-2078(a), (c) | 2 | Household renting rooms to boarders |
| §27-2083(f) | 1 | Household occupying a cellar apartment |
| §27-2085(f) | 1 | Household occupying a cellar unit |
| §27-2086(c) | 1 | Household using a basement with the story above |
| §27-2089(c)(3) | 1 | Plural families in a reduction of legal household count |

The hypothetical entry adds only the source-attested `families` alias, the existing general definition exclusions, and these six exact positive sections within the same HMC source and chapters 1–5. `applicableSections: []` accompanies `applicableExactSections`, preventing prefix leakage into separately numbered descendants and remaining closed for older clients without exact-positive support. Missing section identity also fails closed. Source wording, ID and citation remain unchanged. No shared matching behavior changes.

The audit substitutes this metadata only in memory into the full current registry and checks every one of the 84 ranges against the real reader selection and matcher. It yields exactly eight prospective Family links and no rejected-range links. This is source/matcher evidence, not rendered or physical acceptance.

## Reproduction and next gate

From the repository root:

```sh
node permitext-sync-server/scripts/audit-hmc-family-applicability.mjs
node --test permitext-sync-server/tests/hmc-family-scope-audit.mjs
```

An optional first CLI argument writes a complete audit JSON to that explicit path; without it the script writes no files. Four tests pass: complete range classification/full-registry matching; exact-positive/definition/unknown-section boundaries; source hash drift rejection; and altered definition-body/source/alias rejection.

Before activation, add a separately reviewed source-guarded binding and binding tests, verify the registry delta changes only this entry's applicability/alias metadata, and verify native matching and full rendered popup/citation/Close/viewport return. Keep all section-qualified, compound, kinship and defining contexts plain. This audit does not activate broader Family applicability, resolve the ten deferred source entries, or modify the fixed build 84 release.
