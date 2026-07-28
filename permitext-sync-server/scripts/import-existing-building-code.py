#!/usr/bin/env python3
"""Build Permitext's authored NYCEBC package from enacted Local Law 33 of 2026."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
from pathlib import Path

import pdfplumber


SOURCE_URL = (
    "https://legistar.council.nyc.gov/View.ashx?"
    "GUID=90ED7A3B-B000-43BE-ACC0-117D267BFBDE&ID=15436471&M=F"
)
EFFECTIVE_DATE_SOURCE_URL = "https://www.nyc.gov/site/buildings/codes/existing-building-code.page"
CODE_VERSION = "NYC Existing Building Code - enacted 2026-01-17; effective 2027-07-17"
LIBRARY_ID = "nyc-existing-building-code"
CODE_PREFIX = "EBC"
CHAPTER_ID_BASE = 25_000_000
SECTION_ID_BASE = 26_000_000


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def write_json(path: Path, value: object, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":") if compact else None, indent=None if compact else 2)
        + "\n",
        encoding="utf-8",
    )


def normalized_lines(page_text: str) -> list[str]:
    lines = [re.sub(r"\s+", " ", line).strip() for line in page_text.splitlines()]
    while lines and not lines[0]:
        lines.pop(0)
    while lines and (not lines[-1] or re.fullmatch(r"\d{1,3}", lines[-1])):
        lines.pop()
    return [line for line in lines if line]


def chapter_key(line: str, *, in_code: bool) -> str | None:
    if not in_code:
        return None
    match = re.fullmatch(r"CHAPTER (\d{1,2})", line)
    if match:
        return match.group(1)
    match = re.fullmatch(r"CHAPTER ([A-H]\d{1,2})", line)
    if match:
        return f"APPENDIX-{match.group(1)}"
    match = re.fullmatch(r"APPENDIX ([A-H])", line)
    if match:
        return f"APPENDIX-{match.group(1)}"
    return None


def section_marker(line: str) -> str | None:
    match = re.fullmatch(r"SECTION (?:EBC )?([A-H]?\d{3,4})", line)
    return match.group(1) if match else None


def section_title(lines: list[str], marker_index: int) -> str:
    if marker_index + 1 >= len(lines):
        return ""
    candidate = lines[marker_index + 1]
    if re.match(r"^[A-H]?\d{3,4}(?:\.\d+)*\s", candidate):
        return ""
    return candidate


def search_tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", value.lower()))


def paragraph_html(text: str) -> str:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
    return "\n".join(
        f"<p>{html.escape(part).replace(chr(10), '<br>')}</p>" for part in paragraphs
    )


def extract_pdf(pdf_path: Path) -> tuple[list[list[str]], int]:
    pages: list[list[str]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            pages.append(normalized_lines(page.extract_text() or ""))
        return pages, len(pdf.pages)


def collect_chapters(pages: list[list[str]]) -> tuple[list[dict], list[str]]:
    all_lines = [line for page in pages for line in page]
    enactment_line = next(
        index for index, line in enumerate(all_lines)
        if line.startswith("§ 28-1201.2 Enactment of the New York city existing")
    )
    start = next(
        index for index in range(enactment_line, len(all_lines))
        if all_lines[index] == "THE NEW YORK CITY EXISTING BUILDING CODE"
        and index + 1 < len(all_lines)
        and all_lines[index + 1] == "CHAPTER 1"
    )
    end = next(
        index for index in range(start, len(all_lines))
        if all_lines[index].startswith("§ 3. Notwithstanding any other law or rule")
    )
    code_lines = all_lines[start:end]

    boundaries: list[tuple[int, str]] = []
    for index, line in enumerate(code_lines):
        key = chapter_key(line, in_code=True)
        if key:
            boundaries.append((index, key))
    boundaries = [
        boundary
        for index, boundary in enumerate(boundaries)
        if not (
            boundary[1] in {"APPENDIX-A", "APPENDIX-D"}
            and index + 1 < len(boundaries)
            and boundaries[index + 1][1].startswith(boundary[1])
        )
    ]

    chapters: list[dict] = []
    for boundary_index, (line_index, key) in enumerate(boundaries):
        next_index = boundaries[boundary_index + 1][0] if boundary_index + 1 < len(boundaries) else len(code_lines)
        chunk = code_lines[line_index:next_index]
        if key.startswith("APPENDIX-"):
            title = chunk[1] if len(chunk) > 1 else key.replace("-", " ")
            chapter_number = key.replace("APPENDIX-", "")
        else:
            title = chunk[1] if len(chunk) > 1 else f"Chapter {key}"
            chapter_number = key
        chapters.append({
            "key": key,
            "chapterNumber": chapter_number,
            "title": title,
            "lines": chunk,
        })

    transition_lines = [
        *all_lines[:start],
        *all_lines[end:],
    ]
    return chapters, transition_lines


def build_package(pdf_path: Path, output: Path) -> dict:
    pages, page_count = extract_pdf(pdf_path)
    source_hash = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    raw_chapters, transition_lines = collect_chapters(pages)

    if output.exists():
        shutil.rmtree(output)
    (output / "prepared" / "chapters").mkdir(parents=True)
    (output / "prepared" / "sections").mkdir(parents=True)
    (output / "chapters").mkdir(parents=True)

    bundle_chapters = []
    manifest_chapters = []
    catalog = []
    token_index: dict[str, set[int]] = {}
    section_map: dict[str, int] = {}
    next_section_id = SECTION_ID_BASE

    for chapter_offset, raw in enumerate(raw_chapters, start=1):
        chapter_id = CHAPTER_ID_BASE + chapter_offset
        lines = raw["lines"]
        inline_titles: dict[int, str] = {}
        markers = []
        for index, line in enumerate(lines):
            number = section_marker(line)
            if number:
                markers.append((index, number))
                continue
            appendix_section = re.fullmatch(r"(D\d{3})\s+(.+?)(?:\.)?", line)
            if appendix_section:
                markers.append((index, appendix_section.group(1)))
                inline_titles[index] = appendix_section.group(2).rstrip(".")
        if not markers:
            markers = [(0, f"CHAPTER-{raw['chapterNumber']}")]

        section_summaries = []
        chapter_blocks = []
        for marker_offset, (marker_index, number) in enumerate(markers):
            next_marker = markers[marker_offset + 1][0] if marker_offset + 1 < len(markers) else len(lines)
            title = inline_titles.get(marker_index) or section_title(lines, marker_index)
            body_start = marker_index + (1 if marker_index in inline_titles else (2 if title else 1))
            body_lines = lines[body_start:next_marker]
            if number.startswith("CHAPTER-"):
                title = raw["title"]
                body_lines = lines[2:]
            plain_text = "\n".join(body_lines).strip() or title
            section_id = next_section_id
            next_section_id += 1
            display_number = number.replace("CHAPTER-", "")
            block = {
                "id": f"ebc-{section_id}-block-001",
                "kind": "html",
                "html": paragraph_html(plain_text),
                "plainText": plain_text,
            }
            detail = {
                "schemaVersion": 2,
                "sectionID": section_id,
                "chapterID": chapter_id,
                "chapterNumber": raw["chapterNumber"],
                "sectionNumber": display_number,
                "title": title,
                "officialText": plain_text,
                "previewText": plain_text[:500],
                "blocks": [block],
                "existingBuildingCode": {
                    "schemaVersion": 1,
                    "sourceURL": SOURCE_URL,
                    "sourceSHA256": source_hash,
                    "localLaw": "Local Law 33 of 2026",
                    "enactedDate": "2026-01-17",
                    "effectiveDate": "2027-07-17",
                    "effectiveDateAuthority": "Local Law 42 of 2026",
                    "effectiveDateSourceURL": EFFECTIVE_DATE_SOURCE_URL,
                    "effectiveStatus": "enacted-not-yet-effective",
                    "version": CODE_VERSION,
                    "researchEligibility": True,
                },
            }
            write_json(output / "prepared" / "sections" / f"{section_id}.json", detail, compact=True)
            summary = {
                "id": section_id,
                "sectionNumber": display_number,
                "title": title,
                "officialText": "",
                "kind": "section",
                "contentBlocks": [],
            }
            section_summaries.append(summary)
            catalog.append({
                "id": section_id,
                "chapterID": chapter_id,
                "codePrefix": CODE_PREFIX,
                "codeSectionID": 1,
                "codeVersion": f"CodeContent/authored/new-york-city/2026-existing-building-code/bundle.json#1",
                "chapterNumber": raw["chapterNumber"],
                "sectionNumber": display_number,
                "title": title,
            "headerLine": (
                    f"APPENDIX {raw['chapterNumber'][0]}"
                    if raw["key"].startswith("APPENDIX-")
                    else f"CHAPTER {raw['chapterNumber']}"
                ),
                "headingLine": raw["title"],
            })
            section_map[f"{CODE_PREFIX} {display_number}"] = section_id
            for token in search_tokens(f"{display_number} {title} {plain_text}"):
                token_index.setdefault(token, set()).add(section_id)
            chapter_blocks.append(block)

        group = {
            "id": f"ebc-group-{chapter_id}",
            "headerLine": (
                f"APPENDIX {raw['chapterNumber'][0]}"
                if raw["key"].startswith("APPENDIX-")
                else f"CHAPTER {raw['chapterNumber']}"
            ),
            "headingLine": raw["title"],
            "sections": section_summaries,
        }
        prepared_chapter = {
            "schemaVersion": 1,
            "chapterID": chapter_id,
            "chapterNumber": raw["chapterNumber"],
            "sourceURL": SOURCE_URL,
            "groups": [group],
        }
        write_json(output / "prepared" / "chapters" / f"{chapter_id}.json", prepared_chapter, compact=True)
        chapter_html = (
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            f"<title>{html.escape(raw['title'])}</title></head><body>"
            f"<h1>{html.escape(group['headerLine'])}</h1><h2>{html.escape(raw['title'])}</h2>"
            '<aside><strong>Enacted, not yet effective.</strong> Effective July 17, 2027.</aside>'
            + "".join(
                f"<section id=\"ebc-{summary['id']}\"><h3>EBC {html.escape(summary['sectionNumber'])} "
                f"{html.escape(summary['title'])}</h3>{chapter_blocks[index]['html']}</section>"
                for index, summary in enumerate(section_summaries)
            )
            + f'<p><a href="{html.escape(SOURCE_URL)}">Official enacted source: Local Law 33 of 2026</a></p>'
            "</body></html>"
        )
        (output / "chapters" / f"{raw['chapterNumber']}.html").write_text(chapter_html, encoding="utf-8")
        bundle_chapters.append({
            "id": chapter_id,
            "codeID": 1,
            "codeSectionID": 1,
            "chapterNumber": raw["chapterNumber"],
            "title": f"{group['headerLine']} - {raw['title']}",
        })
        manifest_chapters.append({
            "chapterID": chapter_id,
            "chapterNumber": raw["chapterNumber"],
            "codeSectionID": 1,
            "sectionCount": len(section_summaries),
            "preparedSectionCount": len(section_summaries),
            "blockCount": len(section_summaries),
        })

    bundle = {
        "schemaVersion": 5,
        "chapterStructureSchemaVersion": 1,
        "sectionContentSchemaVersion": 2,
        "jurisdictions": [{"id": 1, "name": "New York City"}],
        "codes": [{"id": 1, "jurisdictionID": 1, "name": CODE_VERSION}],
        "codeSections": [{"id": 1, "codeID": 1, "name": "EXISTING BUILDING CODE"}],
        "chapters": bundle_chapters,
        "tables": [],
        "nextJurisdictionID": 2,
        "nextCodeID": 2,
        "nextCodeSectionID": 2,
        "nextChapterID": CHAPTER_ID_BASE + len(bundle_chapters) + 1,
        "nextSectionID": next_section_id,
        "lastStructuredImportPaths": [],
        "existingBuildingCodeContract": {
            "libraryID": LIBRARY_ID,
            "codePrefix": CODE_PREFIX,
            "sourceURL": SOURCE_URL,
            "sourceSHA256": source_hash,
            "sourcePageCount": page_count,
            "localLaw": "Local Law 33 of 2026",
            "enactedDate": "2026-01-17",
            "effectiveDate": "2027-07-17",
            "effectiveDateAuthority": "Local Law 42 of 2026",
            "effectiveDateSourceURL": EFFECTIVE_DATE_SOURCE_URL,
            "effectiveStatus": "enacted-not-yet-effective",
        },
    }
    write_json(output / "bundle.json", bundle)
    write_json(output / "prepared" / "manifest.json", {
        "schemaVersion": 1,
        "libraryID": LIBRARY_ID,
        "codeVersion": CODE_VERSION,
        "effectiveDate": "2027-07-17",
        "effectiveDateAuthority": "Local Law 42 of 2026",
        "effectiveDateSourceURL": EFFECTIVE_DATE_SOURCE_URL,
        "chapters": manifest_chapters,
    })
    write_json(output / "prepared" / "chapterCatalog.json", {"chapters": catalog})
    write_json(output / "prepared" / "section-map.json", section_map)
    write_json(
        output / "prepared" / "searchIndex.json",
        {"schemaVersion": 1, "tokens": {token: sorted(ids) for token, ids in sorted(token_index.items())}},
        compact=True,
    )
    write_json(output / "source-manifest.json", {
        "schemaVersion": 1,
        "libraryID": LIBRARY_ID,
        "codeVersion": CODE_VERSION,
        "sourceAuthority": "New York City Council",
        "sourceURL": SOURCE_URL,
        "sourceSHA256": source_hash,
        "sourcePageCount": page_count,
        "localLaw": "Local Law 33 of 2026",
        "enactedDate": "2026-01-17",
        "effectiveDate": "2027-07-17",
        "effectiveDateAuthority": "Local Law 42 of 2026",
        "effectiveDateSourceURL": EFFECTIVE_DATE_SOURCE_URL,
        "effectiveStatus": "enacted-not-yet-effective",
        "researchEligibility": True,
        "validationSummary": {
            "chapterCount": len(bundle_chapters),
            "sectionCount": len(catalog),
            "conditionalEffectiveDateProvisionCaptured":
                any("This local law takes effect" in line for line in transition_lines),
        },
    })
    (output / "SOURCE.md").write_text(
        "# NYC Existing Building Code\n\n"
        "This package contains the enacted text from New York City Local Law 33 of 2026.\n\n"
        "- Enacted: January 17, 2026\n"
        "- Effective: July 17, 2027\n"
        "- Status: enacted, not yet effective\n"
        f"- Official source: {SOURCE_URL}\n"
        f"- Effective-date verification: {EFFECTIVE_DATE_SOURCE_URL}\n"
        f"- Source SHA-256: `{source_hash}`\n\n"
        "The package must not be presented as the code currently governing alteration work before "
        "July 17, 2027. Referenced standards and external laws are not reproduced merely because "
        "the EBC cites or incorporates them.\n",
        encoding="utf-8",
    )
    return {
        "chapters": len(bundle_chapters),
        "sections": len(catalog),
        "sourceSHA256": source_hash,
        "conditionalEffectiveDateProvisionCaptured":
            any("This local law takes effect" in line for line in transition_lines),
    }


if __name__ == "__main__":
    args = arguments()
    print(json.dumps(build_package(args.pdf.resolve(), args.output.resolve()), indent=2))
