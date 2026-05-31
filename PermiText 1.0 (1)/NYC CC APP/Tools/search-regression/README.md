# Search regression

Validates shipped `prepared/searchIndex.json` against the app's token search logic.

## Quick start

```bash
cd "NYC CC APP/Tools/search-regression"

# Compare linear haystack (substring terms) vs shipped inverted index (whole tokens)
python3 search_regression.py \
  "../../NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes"

# Lock shipped results as golden (run after intentional search changes)
python3 search_regression.py <bundle-root> --write-golden

# CI: fail if shipped results drift
python3 search_regression.py <bundle-root> --compare-golden
```

## Interpreting linear vs shipped

- **Linear** — whitespace-split terms, each must appear as a **substring** anywhere in the haystack (legacy behavior).
- **Shipped** — same tokenizer as `AuthoredCodeStore`, **whole-token** intersection on `searchIndex.json` (current app).

They will differ for short terms (e.g. `scope` inside other words) and some multi-word queries. That is expected.

Use `--compare-golden` to guard the **shipped** path only.

## Optional: fat-bundle baseline

To compare against pre–Task 8 in-memory text:

```bash
git show 870581e:"NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/bundle.json" \
  > /tmp/fat-bundle.json
python3 search_regression.py <bundle-root> --linear-bundle /tmp/fat-bundle.json
```
