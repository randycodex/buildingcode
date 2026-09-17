# Appendix D HEIGHT occurrence review

2026-09-16 — Source inspection only. These fifteen additional dimensional uses now have source-guarded occurrence exclusions, together with D305. Local JavaScript corpus tests pass (84 tests), and four native/HTML-fallback tests pass, including actual source counts and repeated full-entry D305 decoration. Browser visual acceptance and physical-device acceptance remain separate. This is a targeted inventory, not a claim that every Appendix D occurrence has been semantically accepted.

Implemented scope: D305 court/unit dimensions and the fifteen additional occurrences below; true dwelling-height occurrences in the same sections remain linked. D2 remains undecorated. Definition text/referrals and the ten deferred definition-source entries remain unchanged.

## D3

Source: `2026-existing-building-code/chapters/D3.html`; SHA-256 `5afcadc02ae4e72720dac4a28c66f9aeab1cbeeda9da1d83049e0695a4b5cd3c`.

- `D306.3.1.4`: “…610 mm) or more in clear width and 30 inches (762 mm) or more in clear height. The sill of any such window shall be within 36 inches (914 mm) of the floor. D306.3.2 Lo…”
- `D306.3.12`: “…f a fireproof passageway. Any such passageways shall be not less than 7 feet (2134 mm) in height and not less than 3 feet (914 mm) in width and shall at all times be kept clear and unobs…”

## D6

Source: `2026-existing-building-code/chapters/D6.html`; SHA-256 `7a0308986e8507c35b13a526553a23b391d92cc7fe397d42d740ea6905e88e7c`.

- `D602.2`: “…de at its narrowest part. 3. Every living room shall have a minimum height of 7 feet (2134 mm) if such room is in the basement, of 7 feet (2134 mm) at all points mo…”
- `D603.2`: “…6.5. D603.2 Treads and risers. The treads and risers of every stair shall be of uniform height and width in any 1 flight. Each tread, exclusive of nosing, shall be not less than 9 and…”
- `D603.2`: “…d one-half inches wide (241.5 mm); each riser shall not exceed 7 ¾ inches (197 mm) in height; and the product of the number of inches in the width of the tread and the number of inch…”
- `D603.2`: “…ad and the number of inches in the height of the riser shall be at least 70 inches (1778 mm) and at most 75 inches (1905 mm). D603.3 Public hall…”
- `D604.11`: “…29 mm) wide at its narrowest part; 3. Shall have a minimum height of 7 feet (2134 mm) if such room is in the basement, of 7 feet (2134 mm) at all points mo…”

## D7

Source: `2026-existing-building-code/chapters/D7.html`; SHA-256 `6ef3854f0480c5e1d3a79f6a35b059a50db9ee816e3e396ced2d4965464ba5b7`.

- `D702.1.3`: “…wall. Such penthouses shall have a clear inside height of not less than 9 feet (2743 mm) from finished floor to finished ceiling, and shall not…”
- `D702.1.3`: “…oor to finished ceiling, and shall not exceed 12 feet (3658 mm) in height from the high point of the main roof to the highest point of the penthouse roof. Such pen…”
- `D703.8.4`: “…ucted after April 18, 1929, in any multiple dwelling shall be of uniform height and width in any 1 flight. Each tread, exclusive of nosing, shall be not less than 9.5 in…”
- `D703.8.4`: “…ess than 9.5 inches (241 mm) wide; each riser shall not exceed 7.75 inches (197 mm) in height; and the product of the number of inches in the width of the tread and the number of inch…”
- `D703.8.4`: “…ad and the number of inches in the height of the riser shall be at least 70 and at most 75. 3. No winding stairs shall be constructed. 4. Except…”
- `D703.9.2`: “…studs filled in with brick to the height of the floor beams. D703.9.3 Stair, entrance hall, and public hall construction in certain NLs (MDL 238(3)).…”
- `D703.9.4`: “…wainscoting except a flat base and stair stringers 10 inches (254 mm) or less in height, and all wood railings, balustrades and newel posts shall be removed completely and repla…”
- `D704.4.8`: “…h)). All wood wainscoting except a flat base not exceeding 10 inches (254 mm) in height shall be removed from every hall or passage within a dwelling unit. D704.5 Sprinklers in…”

## Preserved positive checks

- D305: dwelling three stories or less in height; dwellings exceeding two stories in height; height of the dwelling.
- D306: multiple dwellings not more than six stories and 75 feet in height.
- D7 court/room discussions can still contain genuine building-height references. Do not suppress complete sections or nearby words indiscriminately.

Inventory contains 15 additional source occurrences beyond D305’s seven dimensional occurrences. Together the patch excludes 22 reviewed Appendix D HEIGHT occurrences while retaining the neighboring building-height uses.

## Verification evidence

- JavaScript: `/tmp/permitext-occurrence-context-tests.log` — 84 passed.
- Native and WKWebView: `/tmp/permitext-occurrence-native-tests.log` — 4 passed, 2.872 seconds; xcresult `Test-permitext-2026.09.16_23-02-40--0400.xcresult`.
- Mixed §27-830 GRADE: three material occurrences excluded, one ground-surface occurrence retained.
- D305 HEIGHT: seven court/unit dimensions excluded, three dwelling-height occurrences retained; repeated full-registry decoration retains exactly three links.
- Additional scopes: D306 11→9, D602 5→4, D603 5→2, D604 8→7, D702 22→20, D703 24→19, D704 1→0 HEIGHT matches, each verified against actual bundled source.
- Exact phrase rules carry a zero-based term occurrence index. Matching keeps UTF-16 source ranges, whitespace wrapping, inline emphasis and existing source links.

Follow-up source finding: §27-828 in the same guarded `30000071.html` contains two “commercial grade oils” occurrences. Both now have occurrence exclusions; JavaScript actual-corpus checks pass, including a same-scope ground-grade positive control and the adjacent §27-830 ground-grade occurrence. The existing native corpus test now includes §27-828 (2→0); targeted native rerun passed (`/tmp/permitext-oil-grade-native-test.log`, xcresult `Test-permitext-2026.09.16_23-06-53--0400.xcresult`).
