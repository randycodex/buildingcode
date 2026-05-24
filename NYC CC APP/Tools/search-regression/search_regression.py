#!/usr/bin/env python3
"""
Compare search result section IDs across strategies for the NYC CC authored bundle.

Usage:
  ./search_regression.py <bundle-root>                    # linear vs shipped
  ./search_regression.py <bundle-root> --write-golden     # save golden-results.json
  ./search_regression.py <bundle-root> --compare-golden   # fail if differs from golden
  ./search_regression.py <bundle-root> --linear-bundle /path/to/fat-bundle.json

Requires: Python 3.9+
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

DEFAULT_QUERIES_PATH = Path(__file__).with_name("queries.json")
GOLDEN_PATH = Path(__file__).with_name("golden-results.json")
MAX_RESULTS = 200


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    current: list[str] = []

    def flush() -> None:
        nonlocal current
        if len(current) >= 2:
            tokens.append("".join(current))
        current = []

    for ch in text.lower():
        if ch.isspace():
            flush()
        elif ch.isalnum() or ch in ".-":
            current.append(ch)
        else:
            flush()
    flush()
    return tokens


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def chapter_groups(bundle: dict[str, Any], bundle_root: Path, chapter: dict[str, Any]) -> list[dict[str, Any]]:
    groups = chapter.get("groups")
    if groups:
        return groups
    if bundle.get("chapterStructureSchemaVersion", 1) < 2:
        return []
    chapter_id = chapter.get("id")
    if chapter_id is None:
        return []
    prepared_path = bundle_root / "prepared" / "chapters" / f"{chapter_id}.json"
    if not prepared_path.exists():
        return []
    prepared = load_json(prepared_path)
    return prepared.get("groups", [])


def iter_sections(bundle: dict[str, Any], bundle_root: Path, use_prepared_text: bool) -> list[dict[str, Any]]:
    sections: list[dict[str, Any]] = []
    prepared_dir = bundle_root / "prepared" / "sections"

    for chapter in bundle.get("chapters", []):
        chapter_number = chapter.get("chapterNumber", "")
        code_section_id = chapter.get("codeSectionID")
        for group in chapter_groups(bundle, bundle_root, chapter):
            for section in group.get("sections", []):
                section_id = section["id"]
                official_text = section.get("officialText", "")
                if use_prepared_text and not official_text:
                    prepared_path = prepared_dir / f"{section_id}.json"
                    if prepared_path.exists():
                        prepared = load_json(prepared_path)
                        official_text = prepared.get("officialText", "")
                haystack = (
                    f"{section.get('sectionNumber', '')} {section.get('title', '')} {official_text}"
                ).lower()
                sections.append(
                    {
                        "id": section_id,
                        "chapterNumber": chapter_number,
                        "codeSectionID": code_section_id,
                        "sectionNumber": section.get("sectionNumber", ""),
                        "title": section.get("title", ""),
                        "haystack": haystack,
                    }
                )
    return sections


def rank(section: dict[str, Any], query: str) -> int:
    lower = query.lower()
    section_number = section["sectionNumber"].lower()
    title = section["title"].lower()
    if section_number == lower:
        return 0
    if section_number.startswith(lower):
        return 1
    if lower in title:
        return 2
    return 3


def sort_key(section: dict[str, Any]) -> tuple[Any, ...]:
    return (
        section.get("_rank", 3),
        section["chapterNumber"],
        section["sectionNumber"],
    )


def search_linear(sections: list[dict[str, Any]], query: str) -> list[int]:
    trimmed = query.strip()
    if not trimmed:
        return []
    lower = trimmed.lower()
    terms = [t for t in lower.split() if t]
    hits: list[dict[str, Any]] = []
    for section in sections:
        if all(term in section["haystack"] for term in terms):
            enriched = dict(section)
            enriched["_rank"] = rank(section, trimmed)
            hits.append(enriched)
    hits.sort(key=sort_key)
    return [h["id"] for h in hits[:MAX_RESULTS]]


def load_shipped_index(bundle_root: Path) -> dict[str, set[int]]:
    index_path = bundle_root / "prepared" / "searchIndex.json"
    if not index_path.exists():
        raise FileNotFoundError(f"Missing {index_path}")
    payload = load_json(index_path)
    return {token: set(ids) for token, ids in payload["tokens"].items()}


def search_shipped(
    sections_by_id: dict[int, dict[str, Any]],
    shipped_index: dict[str, set[int]],
    query: str,
) -> list[int]:
    trimmed = query.strip()
    if not trimmed:
        return []
    lower = trimmed.lower()
    tokens = tokenize(trimmed)
    if not tokens:
        return []

    candidates = set(shipped_index.get(tokens[0], []))
    for token in tokens[1:]:
        candidates &= shipped_index.get(token, set())
        if not candidates:
            break

    if re.match(r"^[A-Za-z]?\d", trimmed):
        for token, ids in shipped_index.items():
            if token.startswith(lower):
                candidates |= ids

    hits: list[dict[str, Any]] = []
    for section_id in candidates:
        section = sections_by_id.get(section_id)
        if section is None:
            continue
        enriched = dict(section)
        enriched["_rank"] = rank(section, trimmed)
        hits.append(enriched)
    hits.sort(key=sort_key)
    return [h["id"] for h in hits[:MAX_RESULTS]]


def run_comparison(
    bundle_root: Path,
    linear_bundle_path: Path | None,
    *,
    shipped_only: bool,
) -> dict[str, Any]:
    bundle_path = bundle_root / "bundle.json"
    bundle = load_json(bundle_path)
    use_prepared = bundle.get("sectionContentSchemaVersion", 1) >= 2

    linear_source = load_json(linear_bundle_path) if linear_bundle_path else bundle
    sections = iter_sections(linear_source, bundle_root, use_prepared_text=use_prepared)
    sections_by_id = {s["id"]: s for s in sections}

    shipped_index = load_shipped_index(bundle_root)

    queries_path = DEFAULT_QUERIES_PATH
    queries: list[str] = load_json(queries_path)

    report: dict[str, Any] = {
        "bundleRoot": str(bundle_root),
        "sectionContentSchemaVersion": bundle.get("sectionContentSchemaVersion"),
        "queryCount": len(queries),
        "queries": {},
    }

    mismatches = 0
    for query in queries:
        shipped_ids = search_shipped(sections_by_id, shipped_index, query)
        linear_ids: list[int] | None = None
        match = True
        if not shipped_only:
            linear_ids = search_linear(sections, query)
            match = linear_ids == shipped_ids
            if not match:
                mismatches += 1
        report["queries"][query] = {
            "match": match,
            "linearCount": len(linear_ids) if linear_ids is not None else None,
            "shippedCount": len(shipped_ids),
            "linearIDs": linear_ids,
            "shippedIDs": shipped_ids,
        }

    report["mismatchCount"] = mismatches
    report["allMatch"] = mismatches == 0
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Search regression for authored bundle")
    parser.add_argument("bundle_root", type=Path, help="Path to 2022-construction-codes bundle root")
    parser.add_argument(
        "--linear-bundle",
        type=Path,
        help="Fat bundle.json for linear baseline (e.g. exported from git before slim)",
    )
    parser.add_argument("--write-golden", action="store_true", help="Write golden-results.json from shipped index")
    parser.add_argument(
        "--compare-golden",
        action="store_true",
        help="Exit 1 if shipped results differ from golden (CI guard)",
    )
    parser.add_argument(
        "--shipped-only",
        action="store_true",
        help="Skip linear comparison; only run shipped search (for golden write/compare)",
    )
    args = parser.parse_args()

    bundle_root = args.bundle_root.expanduser().resolve()
    if not bundle_root.is_dir():
        print(f"Not a directory: {bundle_root}", file=sys.stderr)
        return 1

    report = run_comparison(
        bundle_root,
        args.linear_bundle,
        shipped_only=args.shipped_only or args.write_golden or args.compare_golden,
    )

    if args.write_golden:
        golden = {q: data["shippedIDs"] for q, data in report["queries"].items()}
        GOLDEN_PATH.write_text(json.dumps(golden, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {GOLDEN_PATH}")

    if args.compare_golden:
        if not GOLDEN_PATH.exists():
            print(f"Missing {GOLDEN_PATH}; run with --write-golden first", file=sys.stderr)
            return 1
        golden = load_json(GOLDEN_PATH)
        drift = [q for q, data in report["queries"].items() if data["shippedIDs"] != golden.get(q)]
        if drift:
            print("Golden drift for queries:", ", ".join(drift), file=sys.stderr)
            return 1
        print("Golden comparison passed.")
        return 0

    if args.write_golden:
        return 0

    if args.shipped_only:
        return 0

    print(json.dumps({"mismatchCount": report["mismatchCount"], "allMatch": report["allMatch"]}, indent=2))
    if not report["allMatch"]:
        for query, data in report["queries"].items():
            if not data["match"]:
                print(f"\nMismatch: {query!r}", file=sys.stderr)
                print(f"  linear ({data['linearCount']}): {data['linearIDs'][:10]}...", file=sys.stderr)
                print(f"  shipped ({data['shippedCount']}): {data['shippedIDs'][:10]}...", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
