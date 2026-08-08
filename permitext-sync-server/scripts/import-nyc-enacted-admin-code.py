#!/usr/bin/env python3
"""Build organized Permitext libraries from NYC Administrative Code Bulk XML.

The importer keeps only the enacted hierarchy and text. American Legal
editorial notes, highlighters, and presentation metadata are excluded.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import xml.etree.ElementTree as ET
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path


ARCHIVE_URL = "https://files.amlegal.com/pdffiles/NewYorkCity/Admin/XML.zip"
OVERVIEW_URL = "https://codelibrary.amlegal.com/codes/newyorkcity/latest/overview"
CODE_VERSION = "NYC Enacted Administrative Code — current through 2026-07-25"
SYNC_VERSION = (
    "CodeContent/authored/new-york-city/"
    "2026-enacted-administrative-code/bundle.json#1"
)
LIBRARY_ID = "nyc-enacted-administrative-code"
CHAPTER_ID_BASE = 30_000_000
SECTION_ID_BASE = 31_000_000


COLLECTIONS = [
    ("T24", "Administrative Code Title 24", 42_985, 45_639),
    ("T25", "Administrative Code Title 25", 45_639, 46_907),
    ("T26", "Administrative Code Title 26", 46_907, 48_176),
    ("T27", "Administrative Code Title 27", 48_176, 207_300),
    ("T28", "Administrative Code Title 28", 207_300, 230_271),
    ("FC", "NYC Fire Code — Title 29", 230_271, 111_265),
]

CODE_DEFINITIONS = [
    ("T24", "ADMINISTRATIVE CODE TITLE 24", "Administrative Code Title 24 — Environmental Protection and Utilities"),
    ("T25", "ADMINISTRATIVE CODE TITLE 25", "Administrative Code Title 25 — Land Use"),
    ("T26", "ADMINISTRATIVE CODE TITLE 26", "Administrative Code Title 26 — Housing and Buildings"),
    ("BC68", "1968 BUILDING CODE", "1968 NYC Building Code — historical"),
    ("HMC", "HOUSING MAINTENANCE CODE", "NYC Housing Maintenance Code"),
    ("T28", "ADMINISTRATIVE CODE TITLE 28", "Administrative Code Title 28 — NYC Construction Codes"),
    ("FC", "FIRE CODE", "NYC Fire Code — Administrative Code Title 29"),
    ("LL", "CONSTRUCTION-RELATED LOCAL LAWS", "NYC Construction-Related Unconsolidated Local Laws"),
]

SOURCE_URLS = {
    "T24": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-42985",
    "T25": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-45639",
    "T26": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-46907",
    "BC68": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-48176",
    "HMC": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-48176",
    "T27": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-48176",
    "T28": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-207300",
    "FC": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-230271",
    "LL": "https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-115120",
}

LOCAL_LAW_PATTERN = re.compile(
    r"\b("
    r"building|construction|demolition|housing|dwelling|landmark|zoning|land use|"
    r"fire code|fire safety|electrical|electrician|energy conservation|energy code|"
    r"noise control|sidewalk shed|scaffold|fa[cç]ade|exterior wall|elevator|boiler|"
    r"plumbing|mechanical code|fuel gas|certificate of occupancy|occupancy group|"
    r"department of buildings|building emissions|benchmarking|parking structure|"
    r"retaining wall|parapet|cooling tower|inspection of gas piping|"
    r"title 2[4-9]|section 2[4-9]-\d"
    r")\b",
    re.IGNORECASE,
)
LOCAL_LAW_CODE_REFERENCE_PATTERN = re.compile(
    r"\b(?:title\s+2[4-9]|section\s+2[4-9]-\d|2[4-9]-\d{3,}(?:\.\d+)*)\b",
    re.IGNORECASE,
)


@dataclass
class Context:
    style: str
    heading: str


@dataclass
class ParsedSection:
    prefix: str
    chapter_key: str
    chapter_number: str
    chapter_title: str
    group_key: str
    group_header: str
    group_heading: str | None
    section_number: str
    title: str
    paragraphs: list[str]
    source_url: str


@dataclass
class ChapterBuild:
    prefix: str
    key: str
    number: str
    title: str
    sections_by_group: dict[str, list[ParsedSection]] = field(
        default_factory=lambda: defaultdict(list)
    )
    group_labels: dict[str, tuple[str, str | None]] = field(default_factory=dict)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--xml-dir", required=True, type=Path)
    parser.add_argument("--archive", required=True, type=Path)
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


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def element_text(element: ET.Element | None, *, skip_highlighters: bool = True) -> str:
    if element is None:
        return ""

    pieces: list[str] = []

    def visit(node: ET.Element) -> None:
        style = (node.get("style-name") or "").lower()
        if skip_highlighters and (
            node.tag == "HIGHLIGHTER" or style.startswith("ednote")
        ):
            if node.tail:
                pieces.append(node.tail)
            return
        if node.text:
            pieces.append(node.text)
        for child in node:
            visit(child)
        if node.tail:
            pieces.append(node.tail)

    visit(element)
    return normalized("".join(pieces))


def first_record_number(path: Path) -> int | None:
    data = path.read_bytes()[:32_768].decode("utf-8-sig", errors="ignore")
    match = re.search(r'<RECORD\b[^>]*\bnumber="(\d+)"', data)
    return int(match.group(1)) if match else None


def node_record_number(xml_dir: Path, node_id: int) -> int:
    value = first_record_number(xml_dir / f"0-0-0-{node_id}.xml")
    if value is None:
        raise ValueError(f"Missing record number for node {node_id}")
    return value


def selected_files(xml_dir: Path, start: int, end: int | None) -> list[Path]:
    indexed = []
    for path in xml_dir.glob("*.xml"):
        number = first_record_number(path)
        if number is not None and number >= start and (end is None or number < end):
            indexed.append((number, path))
    return [path for _, path in sorted(indexed)]


def heading_for_level(level: ET.Element) -> str:
    heading = element_text(level.find("./RECORD/HEADING"))
    return re.sub(r"\b(Preservation)\s+\1\b", r"\1", heading, flags=re.IGNORECASE)


def section_heading_parts(heading: str) -> tuple[str, str]:
    value = normalized(heading)
    value = re.sub(r"^§\s*", "", value)
    local_law = re.match(r"^(L\.L\.\s+\d{4}/\d+)\s*(.*)$", value, re.IGNORECASE)
    if local_law:
        return local_law.group(1), local_law.group(2).strip(" .")
    match = re.match(
        r"^((?:[A-Z]{1,4}\s+)?[A-Z]?\d[\w-]*(?:\.\d+)*(?:\([a-z0-9]+\))?)\s+(.*)$",
        value,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).strip(), match.group(2).strip()
    first, _, rest = value.partition(" ")
    return first or value, rest.strip()


def enacted_paragraphs(level: ET.Element) -> list[str]:
    records = list(level.iter("RECORD"))
    paragraphs: list[str] = []
    for index, record in enumerate(records):
        if index == 0 and record.find("./HEADING") is not None:
            continue
        for paragraph in record.findall(".//PARA"):
            style = (paragraph.get("style-name") or "").lower()
            if style.startswith("ednote") or paragraph.find(".//PARA") is not None:
                continue
            text = element_text(paragraph)
            if not text or re.fullmatch(r"\[ALP [^\]]+\]", text):
                continue
            paragraphs.append(text)
    deduplicated: list[str] = []
    for paragraph in paragraphs:
        if not deduplicated or paragraph != deduplicated[-1]:
            deduplicated.append(paragraph)
    return deduplicated


def context_heading(contexts: list[Context], style: str) -> str | None:
    for context in reversed(contexts):
        if context.style == style and context.heading:
            return context.heading
    return None


def chapter_number_from_heading(heading: str, fallback: str) -> str:
    match = re.search(
        r"\b(?:Chapter|Subchapter|Article|Part)\s+([A-Z0-9.-]+)",
        heading,
        re.IGNORECASE,
    )
    return match.group(1).rstrip(".:") if match else fallback


def classify_prefix(collection_prefix: str, contexts: list[Context]) -> str:
    if collection_prefix != "T27":
        return collection_prefix
    chapter = context_heading(contexts, "Chapter") or ""
    if re.match(r"Chapter\s+1\b", chapter, re.IGNORECASE):
        return "BC68"
    if re.match(r"Chapter\s+2\b", chapter, re.IGNORECASE):
        return "HMC"
    return "T27"


def logical_chapter(prefix: str, contexts: list[Context]) -> tuple[str, str, str]:
    chapter = context_heading(contexts, "Chapter") or f"{prefix} provisions"
    if prefix in {"BC68", "HMC"}:
        subchapter = context_heading(contexts, "Subchapter")
        chosen = subchapter or chapter
    elif prefix == "LL":
        chosen = chapter
    else:
        chosen = chapter
    number = chapter_number_from_heading(chosen, chosen)
    key = f"{prefix}:{chosen}"
    return key, number, chosen


def logical_group(
    contexts: list[Context], chapter_title: str
) -> tuple[str, str, str | None]:
    candidates = [
        context
        for context in contexts
        if context.heading
        and context.heading != chapter_title
        and context.style
        in {"Subchapter", "Appendix", "Part", "Article", "Subarticle", "Subarticle - Part"}
    ]
    if not candidates:
        return chapter_title, chapter_title, None
    deepest = candidates[-1]
    parent = candidates[-2].heading if len(candidates) > 1 else chapter_title
    return "|".join(item.heading for item in candidates), deepest.heading, parent


def parse_file(path: Path, collection_prefix: str) -> list[ParsedSection]:
    root = ET.parse(path).getroot()
    parsed: list[ParsedSection] = []

    def walk(level: ET.Element, contexts: list[Context]) -> None:
        style = level.get("style-name") or ""
        heading = heading_for_level(level)
        next_contexts = contexts + ([Context(style, heading)] if heading else [])
        if style == "Section":
            section_number, title = section_heading_parts(heading)
            paragraphs = enacted_paragraphs(level)
            prefix = classify_prefix(collection_prefix, next_contexts)
            if prefix == "LL":
                preamble_paragraphs: list[str] = []
                for paragraph in paragraphs:
                    if re.match(r"be it enacted\b", paragraph, re.IGNORECASE):
                        break
                    preamble_paragraphs.append(paragraph)
                preamble = " ".join([heading, *preamble_paragraphs])
                full_text = " ".join(paragraphs)
                if not (
                    LOCAL_LAW_PATTERN.search(preamble)
                    or LOCAL_LAW_CODE_REFERENCE_PATTERN.search(full_text)
                ):
                    return
            chapter_key, chapter_number, chapter_title = logical_chapter(prefix, next_contexts)
            group_key, group_header, group_heading = logical_group(
                next_contexts, chapter_title
            )
            parsed.append(
                ParsedSection(
                    prefix=prefix,
                    chapter_key=chapter_key,
                    chapter_number=chapter_number,
                    chapter_title=chapter_title,
                    group_key=group_key,
                    group_header=group_header,
                    group_heading=group_heading,
                    section_number=section_number,
                    title=title,
                    paragraphs=paragraphs,
                    source_url=SOURCE_URLS[prefix],
                )
            )
            return
        for child in level.findall("./LEVEL"):
            walk(child, next_contexts)

    for top_level in root.findall("./LEVEL"):
        walk(top_level, [])
    return parsed


def paragraph_html(paragraphs: list[str]) -> str:
    return "\n".join(f"<p>{html.escape(value)}</p>" for value in paragraphs)


def search_tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", value.lower()))


def build_package(xml_dir: Path, archive: Path, output: Path) -> dict:
    archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    all_sections: list[ParsedSection] = []
    source_documents: list[dict] = []

    for prefix, name, node_id, next_node_id in COLLECTIONS:
        start = node_record_number(xml_dir, node_id)
        end = node_record_number(xml_dir, next_node_id) if next_node_id else None
        paths = selected_files(xml_dir, start, end)
        for path in paths:
            sections = parse_file(path, prefix)
            all_sections.extend(sections)
            source_documents.append(
                {
                    "collection": name,
                    "fileName": path.name,
                    "firstRecordNumber": first_record_number(path),
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    "sectionCount": len(sections),
                }
            )

    appendix_start = node_record_number(xml_dir, 115_120)
    appendix_files = selected_files(xml_dir, appendix_start, None)
    for path in appendix_files:
        sections = parse_file(path, "LL")
        all_sections.extend(sections)
        source_documents.append(
            {
                "collection": "Administrative Code Appendix A",
                "fileName": path.name,
                "firstRecordNumber": first_record_number(path),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "sectionCount": len(sections),
            }
        )

    if output.exists():
        shutil.rmtree(output)
    (output / "prepared" / "chapters").mkdir(parents=True)
    (output / "prepared" / "sections").mkdir(parents=True)
    (output / "chapters").mkdir(parents=True)

    code_id = 1
    code_section_ids = {
        prefix: index
        for index, (prefix, _, _) in enumerate(CODE_DEFINITIONS, start=1)
    }
    chapters: dict[str, ChapterBuild] = {}
    for section in all_sections:
        chapter = chapters.setdefault(
            section.chapter_key,
            ChapterBuild(
                prefix=section.prefix,
                key=section.chapter_key,
                number=section.chapter_number,
                title=section.chapter_title,
            ),
        )
        chapter.sections_by_group[section.group_key].append(section)
        chapter.group_labels[section.group_key] = (
            section.group_header,
            section.group_heading,
        )

    ordered_chapters = sorted(
        chapters.values(),
        key=lambda item: (
            code_section_ids[item.prefix],
            [
                int(piece) if piece.isdigit() else piece.lower()
                for piece in re.split(r"(\d+)", item.number)
            ],
            item.title,
        ),
    )

    bundle_chapters = []
    manifest_chapters = []
    compact_chapter_catalog = []
    chapter_catalog_rows = []
    section_catalog = []
    section_map: dict[str, int] = {}
    token_index: dict[str, set[int]] = defaultdict(set)
    next_section_id = SECTION_ID_BASE

    for chapter_offset, chapter in enumerate(ordered_chapters, start=1):
        chapter_id = CHAPTER_ID_BASE + chapter_offset
        prepared_groups = []
        chapter_section_count = 0
        chapter_block_count = 0
        chapter_html_parts = []

        for group_offset, (group_key, sections) in enumerate(
            chapter.sections_by_group.items(), start=1
        ):
            group_header, group_heading = chapter.group_labels[group_key]
            group_id = f"enacted-{chapter_id}-group-{group_offset:03d}"
            summaries = []
            chapter_html_parts.append(f"<h2>{html.escape(group_header)}</h2>")
            if group_heading and group_heading != group_header:
                chapter_html_parts.append(f"<h3>{html.escape(group_heading)}</h3>")

            for section in sections:
                section_id = next_section_id
                next_section_id += 1
                body_text = "\n\n".join(section.paragraphs).strip()
                if not body_text:
                    body_text = "[Repealed or reserved; no operative text in source.]"
                block = {
                    "id": f"enacted-{section_id}-block-001",
                    "kind": "html",
                    "html": paragraph_html(section.paragraphs)
                    or f"<p>{html.escape(body_text)}</p>",
                    "plainText": body_text,
                }
                detail = {
                    "schemaVersion": 2,
                    "sectionID": section_id,
                    "chapterID": chapter_id,
                    "chapterNumber": chapter.number,
                    "sectionNumber": section.section_number,
                    "title": section.title,
                    "officialText": body_text,
                    "previewText": body_text[:500],
                    "blocks": [block],
                    "enactedTextSource": {
                        "schemaVersion": 1,
                        "sourceAuthority": "New York City Administrative Code",
                        "sourcePublisher": "American Legal Publishing contracted code library",
                        "sourceURL": section.source_url,
                        "archiveURL": ARCHIVE_URL,
                        "archiveSHA256": archive_hash,
                        "statedCurrency": "Current through Local Law 2026/116, enacted July 11, 2026, including amendments effective through July 25, 2026.",
                        "extractionBoundary": "Enacted text only; publisher editorial notes and highlighters excluded.",
                        "verificationStatus": "source-extracted; republication-rights review required before production publication",
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
                summaries.append(summary)
                chapter_catalog_rows.append(
                    {
                        "id": section_id,
                        "chapterID": chapter_id,
                        "codePrefix": chapter.prefix,
                        "codeSectionID": code_section_ids[chapter.prefix],
                        "codeVersion": SYNC_VERSION,
                        "chapterNumber": chapter.number,
                        "sectionNumber": section.section_number,
                        "title": section.title,
                        "headerLine": group_header,
                        "headingLine": group_heading,
                    }
                )
                section_catalog.append(chapter_catalog_rows[-1])
                section_map[
                    f"{chapter.prefix}:{chapter.number}:{section.section_number}"
                ] = section_id
                for token in search_tokens(
                    f"{chapter.prefix} {chapter.title} {group_header} "
                    f"{section.section_number} {section.title} {body_text}"
                ):
                    token_index[token].add(section_id)
                chapter_html_parts.append(
                    f'<section id="section-{section_id}">'
                    f"<h3>{html.escape(section.section_number)} "
                    f"{html.escape(section.title)}</h3>{block['html']}</section>"
                )
                chapter_section_count += 1
                chapter_block_count += 1

            prepared_groups.append(
                {
                    "id": group_id,
                    "headerLine": group_header,
                    "headingLine": group_heading,
                    "sections": summaries,
                }
            )

        prepared_chapter = {
            "schemaVersion": 1,
            "chapterID": chapter_id,
            "chapterNumber": chapter.number,
            "codePrefix": chapter.prefix,
            "groups": prepared_groups,
        }
        write_json(
            output / "prepared" / "chapters" / f"{chapter_id}.json",
            prepared_chapter,
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
                    for group in prepared_groups
                ],
            ]
        )
        (output / "chapters" / f"{chapter_id}.html").write_text(
            "\n".join(chapter_html_parts) + "\n", encoding="utf-8"
        )
        bundle_chapters.append(
            {
                "id": chapter_id,
                "codeID": code_id,
                "codeSectionID": code_section_ids[chapter.prefix],
                "chapterNumber": chapter.number,
                "title": chapter.title,
            }
        )
        manifest_chapters.append(
            {
                "chapterID": chapter_id,
                "chapterNumber": chapter.number,
                "codeSectionID": code_section_ids[chapter.prefix],
                "codePrefix": chapter.prefix,
                "sectionCount": chapter_section_count,
                "preparedSectionCount": chapter_section_count,
                "blockCount": chapter_block_count,
            }
        )

    bundle = {
        "schemaVersion": 5,
        "chapterStructureSchemaVersion": 2,
        "sectionContentSchemaVersion": 2,
        "jurisdictions": [{"id": 1, "name": "New York City"}],
        "codes": [{"id": code_id, "jurisdictionID": 1, "name": CODE_VERSION}],
        "codeSections": [
            {"id": code_section_ids[prefix], "codeID": code_id, "name": name}
            for prefix, name, _ in CODE_DEFINITIONS
        ],
        "chapters": bundle_chapters,
        "tables": [],
        "nextJurisdictionID": 2,
        "nextCodeID": 2,
        "nextCodeSectionID": len(CODE_DEFINITIONS) + 1,
        "nextChapterID": CHAPTER_ID_BASE + len(bundle_chapters) + 1,
        "nextSectionID": next_section_id,
        "lastStructuredImportPaths": [],
        "enactedAdministrativeCodeContract": {
            "libraryID": LIBRARY_ID,
            "sourceAuthority": "New York City Administrative Code",
            "overviewURL": OVERVIEW_URL,
            "archiveURL": ARCHIVE_URL,
            "archiveSHA256": archive_hash,
            "statedCurrency": "Current through Local Law 2026/116, enacted July 11, 2026, including amendments effective through July 25, 2026.",
            "extractionBoundary": "Enacted text only; publisher editorial notes and highlighters excluded.",
            "verificationStatus": "source-extracted; republication-rights review required before production publication",
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
        {"sections": chapter_catalog_rows},
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
            "sourceAuthority": "New York City Administrative Code",
            "sourcePublisher": "American Legal Publishing contracted code library",
            "overviewURL": OVERVIEW_URL,
            "archiveURL": ARCHIVE_URL,
            "archiveSHA256": archive_hash,
            "statedCurrency": "Current through Local Law 2026/116, enacted July 11, 2026, including amendments effective through July 25, 2026.",
            "extractionBoundary": "Enacted text only; publisher editorial notes and highlighters excluded.",
            "verificationStatus": "source-extracted; republication-rights review required before production publication",
            "documents": source_documents,
            "codeSections": [
                {
                    "prefix": prefix,
                    "name": display_name,
                    "chapterCount": sum(
                        1 for chapter in ordered_chapters if chapter.prefix == prefix
                    ),
                    "sectionCount": sum(
                        1 for section in all_sections if section.prefix == prefix
                    ),
                    "sourceURL": SOURCE_URLS[prefix],
                }
                for prefix, _, display_name in CODE_DEFINITIONS
            ],
        },
    )
    (output / "SOURCE.md").write_text(
        "# NYC enacted Administrative Code expansion\n\n"
        f"- Source authority: New York City Administrative Code\n"
        f"- Source library: {OVERVIEW_URL}\n"
        f"- Bulk XML archive: {ARCHIVE_URL}\n"
        f"- Archive SHA-256: `{archive_hash}`\n"
        "- Currency: Current through Local Law 2026/116, enacted July 11, 2026, "
        "including amendments effective through July 25, 2026.\n"
        "- Boundary: enacted text only. Publisher editor notes, highlighters, "
        "front matter, and presentation styling are excluded.\n"
        "- Publication gate: confirm source-text republication rights before "
        "production publication.\n",
        encoding="utf-8",
    )
    return {
        "chapterCount": len(bundle_chapters),
        "sectionCount": len(section_catalog),
        "codeSections": {
            prefix: sum(1 for section in all_sections if section.prefix == prefix)
            for prefix, _, _ in CODE_DEFINITIONS
        },
        "archiveSHA256": archive_hash,
    }


def main() -> None:
    args = arguments()
    result = build_package(args.xml_dir, args.archive, args.output)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
