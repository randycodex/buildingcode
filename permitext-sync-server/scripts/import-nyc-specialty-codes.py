#!/usr/bin/env python3
"""Build organized 2025 NYC Energy and Electrical authored-code packages."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

import pdfplumber


LIBRARY_ID = "nyc-2025-specialty-codes"
CODE_VERSION = "2025 NYC Energy Conservation and Electrical Codes"
SYNC_VERSION = (
    "CodeContent/authored/new-york-city/2025-specialty-codes/bundle.json#1"
)
CHAPTER_ID_BASE = 32_000_000
SECTION_ID_BASE = 33_000_000
ENERGY_PAGE_URL = (
    "https://www.nyc.gov/site/buildings/codes/2025-energy-conservation-code.page"
)
ELECTRICAL_PAGE_URL = (
    "https://www.nyc.gov/site/buildings/codes/electrical-code.page"
)
ELECTRICAL_PDF_URL = (
    "https://www.nyc.gov/assets/buildings/codes-pdf/2025electrical_code.pdf"
)


ENERGY_FILES = [
    ("2025nycecc_c1.pdf", "1", "CHAPTER 1 — ADMINISTRATION"),
    ("2025nycecc_r2.pdf", "R2", "CHAPTER R2 — DEFINITIONS"),
    ("2025nycecc_r3.pdf", "R3", "CHAPTER R3 — GENERAL REQUIREMENTS"),
    ("2025nycecc_r4.pdf", "R4", "CHAPTER R4 — RESIDENTIAL ENERGY EFFICIENCY"),
    ("2025nycecc_r5.pdf", "R5", "CHAPTER R5 — EXISTING BUILDINGS"),
    ("2025nycecc_r6.pdf", "R6", "CHAPTER R6 — REFERENCED STANDARDS"),
    (
        "2025nycecc_appendix_rf.pdf",
        "RF",
        "APPENDIX RF — ALTERNATIVE BUILDING THERMAL ENVELOPE INSULATION R-VALUE OPTIONS",
    ),
    ("2025nycecc_c2.pdf", "C2", "CHAPTER C2 — DEFINITIONS"),
    ("2025nycecc_c3.pdf", "C3", "CHAPTER C3 — GENERAL REQUIREMENTS"),
    ("2025nycecc_c4.pdf", "C4", "CHAPTER C4 — COMMERCIAL ENERGY EFFICIENCY"),
    ("2025nycecc_c5.pdf", "C5", "CHAPTER C5 — EXISTING BUILDINGS"),
    ("2025nycecc_c6.pdf", "C6", "CHAPTER C6 — REFERENCED STANDARDS"),
    (
        "2025nyc_ashrae.pdf",
        "ASHRAE",
        "2025 NYC ASHRAE 90.1 — MODIFIED ENERGY STANDARD",
    ),
]


@dataclass
class SourceSection:
    prefix: str
    chapter_number: str
    chapter_title: str
    group_header: str
    section_number: str
    title: str
    text: str
    source_url: str
    source_hash: str


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--energy-dir", required=True, type=Path)
    parser.add_argument("--electrical-pdf", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def write_json(path: Path, value: object, *, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":") if compact else None,
            indent=None if compact else 2,
        )
        + "\n",
        encoding="utf-8",
    )


def normalized_line(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def pdf_lines(path: Path) -> tuple[list[str], int]:
    lines: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_lines = [
                normalized_line(line)
                for line in (page.extract_text() or "").splitlines()
            ]
            for line in page_lines:
                if not line:
                    continue
                if re.fullmatch(r"\d+", line):
                    continue
                if line in {
                    "NEW YORK CITY ELECTRICAL CODE",
                    "THE NEW YORK CITY ELECTRICAL CODE",
                    "2025.12.21",
                }:
                    continue
                lines.append(line)
        return lines, len(pdf.pages)


def source_url_for_energy(file_name: str) -> str:
    return (
        "https://www.nyc.gov/assets/buildings/codes-pdf/"
        f"energy_code_2025/{file_name}"
    )


def split_energy_file(
    path: Path, chapter_number: str, chapter_title: str
) -> list[SourceSection]:
    lines, _ = pdf_lines(path)
    source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    if chapter_number == "ASHRAE":
        return split_ashrae(lines, source_hash, path.name, chapter_title)

    boundaries: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        match = re.fullmatch(r"SECTION\s+(?:ECC\s+)?([A-Z]*\d+)", line)
        if match:
            boundaries.append((index, match.group(1)))
    if not boundaries:
        boundaries = [(0, chapter_number)]

    result = []
    for offset, (index, section_number) in enumerate(boundaries):
        end = boundaries[offset + 1][0] if offset + 1 < len(boundaries) else len(lines)
        chunk = lines[index + 1 : end]
        while chunk and (
            chunk[0].upper().startswith("CHAPTER ")
            or chunk[0] == chapter_title.split(" — ")[-1]
        ):
            chunk.pop(0)
        title = chunk.pop(0) if chunk and not re.match(r"^[A-Z]*\d+\.\d+", chunk[0]) else ""
        text = "\n".join(chunk).strip()
        result.append(
            SourceSection(
                prefix="ECC",
                chapter_number=chapter_number,
                chapter_title=chapter_title,
                group_header=f"SECTION ECC {section_number}",
                section_number=section_number,
                title=title or "GENERAL",
                text=text or "[Reserved; no operative text in source.]",
                source_url=source_url_for_energy(path.name),
                source_hash=source_hash,
            )
        )
    return result


def split_ashrae(
    lines: list[str], source_hash: str, file_name: str, chapter_title: str
) -> list[SourceSection]:
    boundaries: list[tuple[int, str, str]] = []
    for index, line in enumerate(lines):
        match = re.fullmatch(r"(\d{1,2})\.\s+([A-Z][A-Z ,/&()-]+)", line)
        if match:
            boundaries.append((index, match.group(1), match.group(2).title()))
        appendix = re.fullmatch(r"(APPENDIX\s+[A-Z])\s*[-—:]?\s*(.*)", line, re.IGNORECASE)
        if appendix:
            boundaries.append(
                (index, appendix.group(1).upper().replace(" ", "-"), appendix.group(2) or "Appendix")
            )
    unique: list[tuple[int, str, str]] = []
    seen = set()
    for boundary in boundaries:
        if boundary[1] in seen:
            continue
        seen.add(boundary[1])
        unique.append(boundary)
    if not unique:
        unique = [(0, "ASHRAE", "Modified Energy Standard")]
    result = []
    for offset, (index, number, title) in enumerate(unique):
        end = unique[offset + 1][0] if offset + 1 < len(unique) else len(lines)
        text = "\n".join(lines[index + 1 : end]).strip()
        result.append(
            SourceSection(
                prefix="ECC",
                chapter_number="ASHRAE",
                chapter_title=chapter_title,
                group_header=f"2025 NYC ASHRAE 90.1 — {number}",
                section_number=f"ASHRAE-{number}",
                title=title,
                text=text or "[Reserved; no operative text in source.]",
                source_url=source_url_for_energy(file_name),
                source_hash=source_hash,
            )
        )
    return result


def split_electrical(path: Path) -> list[SourceSection]:
    lines, _ = pdf_lines(path)
    source_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    active_chapter_number = "ADMIN"
    active_chapter_title = "ARTICLE 1101 — ENACTMENT AND NYC ADMINISTRATIVE PROVISIONS"
    boundaries = []
    for index, line in enumerate(lines):
        chapter = re.fullmatch(r"CHAPTER\s+(\d+)", line)
        if chapter:
            active_chapter_number = chapter.group(1)
            following = lines[index + 1] if index + 1 < len(lines) else ""
            active_chapter_title = f"CHAPTER {active_chapter_number} — {following}"
            continue
        marker = re.fullmatch(r"SECTION\s+(?:EC\s+)?([0-9.]+)", line)
        article = re.fullmatch(r"ARTICLE\s+(\d+)", line)
        if marker:
            boundaries.append(
                (
                    index,
                    active_chapter_number,
                    active_chapter_title,
                    marker.group(1),
                    f"SECTION {line.removeprefix('SECTION ').strip()}",
                )
            )
        elif article and (not boundaries or boundaries[-1][0] != index):
            boundaries.append(
                (
                    index,
                    active_chapter_number,
                    active_chapter_title,
                    f"ARTICLE-{article.group(1)}",
                    f"ARTICLE {article.group(1)}",
                )
            )
    if not boundaries:
        boundaries = [(0, "ADMIN", active_chapter_title, "28-1101", "ARTICLE 1101")]

    result = []
    for offset, boundary in enumerate(boundaries):
        index, chapter_number, chapter_title, number, group = boundary
        end = boundaries[offset + 1][0] if offset + 1 < len(boundaries) else len(lines)
        chunk = lines[index + 1 : end]
        while chunk and (
            re.fullmatch(r"CHAPTER\s+\d+", chunk[0])
            or chunk[0] == chapter_title.split(" — ")[-1]
        ):
            chunk.pop(0)
        title = chunk.pop(0) if chunk and len(chunk[0]) < 120 else ""
        text = "\n".join(chunk).strip()
        result.append(
            SourceSection(
                prefix="EC",
                chapter_number=chapter_number,
                chapter_title=chapter_title,
                group_header=group,
                section_number=number,
                title=title or "NYC AMENDMENT",
                text=text or "[Reserved; no operative text in source.]",
                source_url=ELECTRICAL_PDF_URL,
                source_hash=source_hash,
            )
        )
    return result


def paragraph_html(text: str) -> str:
    parts = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
    if not parts:
        parts = [text]
    return "\n".join(
        f"<p>{html.escape(part).replace(chr(10), '<br>')}</p>" for part in parts
    )


def search_tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", value.lower()))


def build_package(energy_dir: Path, electrical_pdf: Path, output: Path) -> dict:
    sections: list[SourceSection] = []
    source_files = []
    for file_name, chapter_number, chapter_title in ENERGY_FILES:
        path = energy_dir / file_name
        if not path.exists():
            raise FileNotFoundError(path)
        extracted = split_energy_file(path, chapter_number, chapter_title)
        sections.extend(extracted)
        with pdfplumber.open(path) as pdf:
            page_count = len(pdf.pages)
        source_files.append(
            {
                "fileName": file_name,
                "sourceURL": source_url_for_energy(file_name),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "pageCount": page_count,
                "sectionCount": len(extracted),
            }
        )
    electrical_sections = split_electrical(electrical_pdf)
    sections.extend(electrical_sections)
    with pdfplumber.open(electrical_pdf) as pdf:
        electrical_pages = len(pdf.pages)
    source_files.append(
        {
            "fileName": electrical_pdf.name,
            "sourceURL": ELECTRICAL_PDF_URL,
            "sha256": hashlib.sha256(electrical_pdf.read_bytes()).hexdigest(),
            "pageCount": electrical_pages,
            "sectionCount": len(electrical_sections),
        }
    )

    if output.exists():
        shutil.rmtree(output)
    (output / "prepared" / "chapters").mkdir(parents=True)
    (output / "prepared" / "sections").mkdir(parents=True)
    (output / "chapters").mkdir(parents=True)

    chapters: dict[tuple[str, str, str], list[SourceSection]] = {}
    for section in sections:
        chapters.setdefault(
            (section.prefix, section.chapter_number, section.chapter_title), []
        ).append(section)

    code_section_ids = {"ECC": 1, "EC": 2}
    bundle_chapters = []
    manifest_chapters = []
    compact_chapter_catalog = []
    catalog = []
    section_map = {}
    token_index: dict[str, set[int]] = {}
    next_section_id = SECTION_ID_BASE

    for chapter_offset, ((prefix, number, title), chapter_sections) in enumerate(
        chapters.items(), start=1
    ):
        chapter_id = CHAPTER_ID_BASE + chapter_offset
        groups = []
        html_parts = []
        for group_offset, section in enumerate(chapter_sections, start=1):
            section_id = next_section_id
            next_section_id += 1
            block = {
                "id": f"specialty-{section_id}-block-001",
                "kind": "html",
                "html": paragraph_html(section.text),
                "plainText": section.text,
            }
            detail = {
                "schemaVersion": 2,
                "sectionID": section_id,
                "chapterID": chapter_id,
                "chapterNumber": number,
                "sectionNumber": section.section_number,
                "title": section.title,
                "officialText": section.text,
                "previewText": section.text[:500],
                "blocks": [block],
                "specialtyCodeSource": {
                    "schemaVersion": 1,
                    "sourceAuthority": "New York City Department of Buildings",
                    "sourceURL": section.source_url,
                    "sourceSHA256": section.source_hash,
                    "effectiveDate": "2026-03-30" if prefix == "ECC" else "2025-12-21",
                    "effectiveStatus": "effective",
                    "extractionBoundary": (
                        "Official integrated NYC Energy Code publication."
                        if prefix == "ECC"
                        else "NYC-enacted amendments only; adopted NFPA 70 text is not reproduced."
                    ),
                    "researchEligibility": True,
                },
            }
            write_json(
                output / "prepared" / "sections" / f"{section_id}.json",
                detail,
                compact=True,
            )
            summary = {
                "id": section_id,
                "sectionNumber": section.section_number,
                "title": section.title,
                "officialText": "",
                "kind": "section",
                "contentBlocks": [],
            }
            groups.append(
                {
                    "id": f"specialty-{chapter_id}-group-{group_offset:03d}",
                    "headerLine": section.group_header,
                    "headingLine": title,
                    "sections": [summary],
                }
            )
            row = {
                "id": section_id,
                "chapterID": chapter_id,
                "codePrefix": prefix,
                "codeSectionID": code_section_ids[prefix],
                "codeVersion": SYNC_VERSION,
                "chapterNumber": number,
                "sectionNumber": section.section_number,
                "title": section.title,
                "headerLine": section.group_header,
                "headingLine": title,
            }
            catalog.append(row)
            section_map[f"{prefix}:{number}:{section.section_number}"] = section_id
            for token in search_tokens(
                f"{prefix} {number} {title} {section.section_number} "
                f"{section.title} {section.text}"
            ):
                token_index.setdefault(token, set()).add(section_id)
            html_parts.append(
                f'<section id="section-{section_id}">'
                f"<h2>{html.escape(section.group_header)}</h2>"
                f"<h3>{html.escape(section.section_number)} "
                f"{html.escape(section.title)}</h3>{block['html']}</section>"
            )

        write_json(
            output / "prepared" / "chapters" / f"{chapter_id}.json",
            {
                "schemaVersion": 1,
                "chapterID": chapter_id,
                "chapterNumber": number,
                "codePrefix": prefix,
                "groups": groups,
            },
            compact=True,
        )
        compact_chapter_catalog.append(
            [
                chapter_id,
                [
                    [
                        group["id"],
                        group["headerLine"],
                        group["headingLine"],
                        None,
                        None,
                        [
                            [
                                section["id"],
                                section["sectionNumber"],
                                section["title"],
                                section["kind"],
                            ]
                            for section in group["sections"]
                        ],
                    ]
                    for group in groups
                ],
            ]
        )
        (output / "chapters" / f"{chapter_id}.html").write_text(
            "\n".join(html_parts) + "\n", encoding="utf-8"
        )
        bundle_chapters.append(
            {
                "id": chapter_id,
                "codeID": 1,
                "codeSectionID": code_section_ids[prefix],
                "chapterNumber": number,
                "title": title,
            }
        )
        manifest_chapters.append(
            {
                "chapterID": chapter_id,
                "chapterNumber": number,
                "codeSectionID": code_section_ids[prefix],
                "codePrefix": prefix,
                "sectionCount": len(chapter_sections),
                "preparedSectionCount": len(chapter_sections),
                "blockCount": len(chapter_sections),
            }
        )

    bundle = {
        "schemaVersion": 5,
        "chapterStructureSchemaVersion": 2,
        "sectionContentSchemaVersion": 2,
        "jurisdictions": [{"id": 1, "name": "New York City"}],
        "codes": [{"id": 1, "jurisdictionID": 1, "name": CODE_VERSION}],
        "codeSections": [
            {"id": 1, "codeID": 1, "name": "2025 ENERGY CONSERVATION CODE"},
            {"id": 2, "codeID": 1, "name": "2025 ELECTRICAL CODE — NYC AMENDMENTS"},
        ],
        "chapters": bundle_chapters,
        "tables": [],
        "nextJurisdictionID": 2,
        "nextCodeID": 2,
        "nextCodeSectionID": 3,
        "nextChapterID": CHAPTER_ID_BASE + len(bundle_chapters) + 1,
        "nextSectionID": next_section_id,
        "lastStructuredImportPaths": [],
        "specialtyCodeContract": {
            "libraryID": LIBRARY_ID,
            "energySourceURL": ENERGY_PAGE_URL,
            "energyEffectiveDate": "2026-03-30",
            "electricalSourceURL": ELECTRICAL_PAGE_URL,
            "electricalEffectiveDate": "2025-12-21",
            "electricalBoundary": "NYC-enacted amendments only; adopted NFPA 70 text is not reproduced.",
        },
    }
    write_json(output / "bundle.json", bundle)
    write_json(
        output / "prepared" / "manifest.json",
        {
            "schemaVersion": 1,
            "libraryID": LIBRARY_ID,
            "codeVersion": CODE_VERSION,
            "chapters": manifest_chapters,
        },
    )
    write_json(
        output / "prepared" / "chapterCatalog.json",
        {"schemaVersion": 1, "chapters": compact_chapter_catalog},
    )
    write_json(
        output / "prepared" / "sectionCatalog.json",
        {"sections": catalog},
        compact=True,
    )
    write_json(
        output / "prepared" / "searchIndex.json",
        {
            "schemaVersion": 1,
            "tokens": {
                token: sorted(ids) for token, ids in sorted(token_index.items())
            },
        },
        compact=True,
    )
    write_json(output / "prepared" / "section-map.json", section_map)
    write_json(
        output / "source-manifest.json",
        {
            "schemaVersion": 1,
            "libraryID": LIBRARY_ID,
            "codeVersion": CODE_VERSION,
            "sourceAuthority": "New York City Department of Buildings",
            "energySourceURL": ENERGY_PAGE_URL,
            "energyEffectiveDate": "2026-03-30",
            "electricalSourceURL": ELECTRICAL_PAGE_URL,
            "electricalEffectiveDate": "2025-12-21",
            "electricalBoundary": "NYC-enacted amendments only; adopted NFPA 70 text is not reproduced.",
            "files": source_files,
        },
    )
    (output / "SOURCE.md").write_text(
        "# 2025 NYC specialty codes\n\n"
        f"- Energy authority and contents: {ENERGY_PAGE_URL}\n"
        "- Energy effective date: March 30, 2026.\n"
        f"- Electrical authority: {ELECTRICAL_PAGE_URL}\n"
        "- Electrical effective date: December 21, 2025.\n"
        "- Electrical boundary: NYC-enacted amendments are included. The adopted "
        "2020 NFPA 70 text is referenced but not reproduced.\n",
        encoding="utf-8",
    )
    return {
        "chapterCount": len(bundle_chapters),
        "sectionCount": len(catalog),
        "energySectionCount": sum(1 for section in sections if section.prefix == "ECC"),
        "electricalSectionCount": sum(1 for section in sections if section.prefix == "EC"),
    }


def main() -> None:
    args = arguments()
    print(
        json.dumps(
            build_package(args.energy_dir, args.electrical_pdf, args.output),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
