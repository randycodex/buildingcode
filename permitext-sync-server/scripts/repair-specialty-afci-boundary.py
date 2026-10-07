#!/usr/bin/env python3
"""Separate the existing official AFCI extraction without renumbering saved sections.

No source text is authored here. The old extraction contains a published SECTION
210.12(A) marker; its exact suffix becomes a separately indexed source record.
"""
import argparse
import copy
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2025-specialty-codes"
OLD_ID, NEW_ID, CHAPTER = 33000088, 33000361, 32000016
MARKER = "\nSECTION 210.12(A)\n"


def repair(root):
    def load(name):
        return json.loads((root / name).read_text())

    old = load(f"prepared/sections/{OLD_ID}.json")
    if MARKER not in old["officialText"]:
        new = load(f"prepared/sections/{NEW_ID}.json")
        assert new["sectionNumber"] == "210.12(A)" and "AFCI protection" in new["officialText"]
        return {}
    original = old["officialText"]
    retained, suffix = original.split(MARKER)
    title, moved = suffix.split("\n", 1)
    assert original == retained + MARKER + title + "\n" + moved
    new = copy.deepcopy(old)
    new.update(sectionID=NEW_ID, sectionNumber="210.12(A)", title=title)
    for detail, identifier, text in [(old, OLD_ID, retained), (new, NEW_ID, moved)]:
        escaped = html.escape(text).replace("\n", "<br>")
        detail.update(officialText=text, previewText=text[:500], blocks=[{
            "id": f"specialty-{identifier}-block-001", "kind": "html",
            "html": f"<p>{escaped}</p>", "plainText": text
        }])
    outputs = {f"prepared/sections/{OLD_ID}.json": old, f"prepared/sections/{NEW_ID}.json": new}
    chapter = load(f"prepared/chapters/{CHAPTER}.json")
    parent = next(group for group in chapter["groups"] if group["sections"][0]["id"] == OLD_ID)
    group = copy.deepcopy(parent)
    group.update(id=f"specialty-{CHAPTER}-group-210-12-a", headerLine="SECTION 210.12(A)")
    group["sections"][0].update(id=NEW_ID, sectionNumber=new["sectionNumber"], title=title)
    chapter["groups"].insert(chapter["groups"].index(parent) + 1, group)
    outputs[f"prepared/chapters/{CHAPTER}.json"] = chapter
    catalog = load("prepared/sectionCatalog.json")
    parent_row = next(row for row in catalog["sections"] if row["id"] == OLD_ID)
    row = dict(parent_row, id=NEW_ID, sectionNumber=new["sectionNumber"], title=title, headerLine=group["headerLine"])
    catalog["sections"].insert(catalog["sections"].index(parent_row) + 1, row)
    outputs["prepared/sectionCatalog.json"] = catalog
    compact_catalog = load("prepared/chapterCatalog.json")
    entry = next(entry for entry in compact_catalog["chapters"] if entry[0] == CHAPTER)
    entry[1] = [[g["id"],g["headerLine"],g["headingLine"],None,None,
        [[s["id"],s["sectionNumber"],s["title"],s["kind"]] for s in g["sections"]]] for g in chapter["groups"]]
    outputs["prepared/chapterCatalog.json"] = compact_catalog
    section_map = load("prepared/section-map.json")
    section_map["EC:2:210.12(A)"] = NEW_ID
    outputs["prepared/section-map.json"] = section_map
    manifest = load("prepared/manifest.json")
    entry = next(entry for entry in manifest["chapters"] if entry["chapterID"] == CHAPTER)
    for key in ["sectionCount", "preparedSectionCount", "blockCount"]:
        entry[key] += 1
    outputs["prepared/manifest.json"] = manifest
    bundle = load("bundle.json")
    assert bundle["nextSectionID"] == NEW_ID
    bundle["nextSectionID"] = NEW_ID + 1
    outputs["bundle.json"] = bundle
    source_manifest = load("source-manifest.json")
    next(file for file in source_manifest["files"] if file["sourceURL"].endswith("2025electrical_code.pdf"))["sectionCount"] += 1
    source_manifest["extractionRepairs"] = [{"sectionNumber":"210.12(A)","parentSectionID":OLD_ID,
        "sectionID":NEW_ID,"verifiedAt":"2026-10-07","basis":"Published SECTION 210.12(A) marker, official PDF page 9; text separated without alteration and all previous section IDs retained."}]
    outputs["source-manifest.json"] = source_manifest
    search = load("prepared/searchIndex.json")
    for token, identifiers in list(search["tokens"].items()):
        if OLD_ID in identifiers:
            identifiers.remove(OLD_ID)
            if not identifiers:
                del search["tokens"][token]
    for detail in [old, new]:
        text = f'EC 2 {parent_row["headingLine"]} {detail["sectionNumber"]} {detail["title"]} {detail["officialText"]}'
        for token in set(re.findall(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", text.lower())):
            search["tokens"].setdefault(token, []).append(detail["sectionID"])
    search["tokens"] = {token:sorted(set(identifiers)) for token,identifiers in sorted(search["tokens"].items())}
    outputs["prepared/searchIndex.json"] = search
    fragments = []
    for group in chapter["groups"]:
        for summary in group["sections"]:
            detail = outputs.get(f'prepared/sections/{summary["id"]}.json') or load(f'prepared/sections/{summary["id"]}.json')
            fragments.append(f'<section id="section-{summary["id"]}"><h2>{html.escape(group["headerLine"])}</h2>'
                f'<h3>{html.escape(summary["sectionNumber"])} {html.escape(summary["title"])}</h3>'
                + "".join(block["html"] for block in detail["blocks"]) + "</section>")
    outputs[f"chapters/{CHAPTER}.html"] = "\n".join(fragments) + "\n"
    return outputs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    outputs = repair(args.root)
    if outputs and not args.write:
        raise SystemExit("AFCI section boundary requires repair; rerun with --write.")
    for name, value in outputs.items():
        pretty = name in ["bundle.json", "source-manifest.json", "prepared/manifest.json", "prepared/chapterCatalog.json", "prepared/section-map.json"]
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False,
            indent=2 if pretty else None, separators=None if pretty else (",", ":")) + "\n"
        (args.root / name).write_text(text)
    print(f"AFCI boundary verified; {len(outputs)} artifacts updated.")
