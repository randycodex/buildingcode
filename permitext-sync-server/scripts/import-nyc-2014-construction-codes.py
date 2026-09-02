#!/usr/bin/env python3
"""Build Permitext's historical 2014 NYC Construction Codes corpus.

Only enacted text verified against official NYC Department of Buildings and New
York City Council sources is emitted.  The DOB chapter PDFs are treated as the
consolidated archive.  ICC Digital Codes HTML may be retained as a secondary
structure reference for tables, equations, and semantic inline formatting, but
it never replaces the official PDF provenance or the independent verification
gate.  The official amendment index, update packets, and Local Law 141 of 2013
are retained as provenance and reconciliation sources; they are never replayed
blindly over the consolidated PDFs.

Text is extracted independently with pdfplumber and Poppler.  pdfplumber owns
the line coordinates used for section provenance.  Poppler provides the second
text extraction and the independent word map used to verify table cells.  A
table is emitted as structured data only when its grid and cell text reconcile.
Figures and unresolved tables are rendered solely from the official PDF page
and are explicitly marked review-required.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import html
import json
import re
import shutil
import subprocess
import sys
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

import pdfplumber


CODE_PAGE_URL = "https://www.nyc.gov/site/buildings/codes/2014-construction-codes.page"
UPDATE_PAGE_URL = "https://www.nyc.gov/site/buildings/codes/2014-construction-codes-updates.page"
PRIOR_CODES_URL = "https://www.nyc.gov/site/buildings/codes/prior-codes.page"
PDF_ROOT_URL = "https://www.nyc.gov/assets/buildings/codes-pdf/cons_codes_2014/"
AMENDMENT_INDEX_URL = "https://www.nyc.gov/assets/buildings/building_code/AmendmentIndexCombined_2014.pdf"
LOCAL_LAW_141_URL = "https://www.nyc.gov/assets/buildings/local_laws/ll141of2013.pdf"
ICC_2014_BUILDING_CODE_CHAPTER_7_URL = (
    "https://codes.iccsafe.org/content/NYNYCBC2014E1014/"
    "chapter-7-fire-and-smoke-protection-features"
)
ICC_2014_BUILDING_CODE_CHAPTER_10_URL = (
    "https://codes.iccsafe.org/content/NYNYCBC2014E1014/"
    "chapter-10-means-of-egress"
)
ICC_BC10_TABLE_PDF_PAGES = {
    "1004.1.1": [5, 6],
    "1008.1.4.1": [14],
    "1015.1": [35],
    "1016.1": [37],
    "1018.1.1": [39],
    "1018.1.2": [39],
    "1021.1": [41],
    "1021.2": [42],
    "1028.6.2": [56],
    "1028.7": [56],
    "1028.10.1": [58],
}
CURATED_BC_705_7_TEXT = """Where protected openings are not limited by Section 705.8, the limitation on the rise of temperature on the unexposed surface of exterior walls as required by ASTM E 119 or UL 263 shall not apply. Where protected openings are limited by Section 705.8, the limitation on the rise of temperature on the unexposed surface of exterior walls as required by ASTM E 119 or UL 263 shall not apply provided that a correction is made for radiation from the unexposed exterior wall surface in accordance with the following formula:

A_e = A + (A_f × F_eo) (Equation 7-1)

where:
A_e = Equivalent area of protected openings.
A = Actual area of protected openings.
A_f = Area of exterior wall surface in the story under consideration exclusive of openings, on which the temperature limitations of ASTM E 119 or UL 263 for walls are exceeded.
F_eo = An “equivalent opening factor” derived from Figure 705.7 based on the average temperature of the unexposed wall surface and the fire-resistance rating of the wall."""
SYNC_VERSION = "CodeContent/authored/new-york-city/2014-construction-codes/bundle.json#1"
CODE_VERSION = "2014 NYC Construction Codes - DOB consolidated archive"
LIBRARY_ID = "nyc-2014-construction-codes"
CHAPTER_ID_BASE = 40_000_000
SECTION_ID_BASE = 41_000_000
TABLE_ID_PREFIX = "nyc-2014-table"
USER_AGENT = "Mozilla/5.0 (compatible; Permitext official-code corpus builder)"

CODE_NAMES = {
    "AC": "ADMINISTRATIVE PROVISIONS",
    "BC": "BUILDING CODE",
    "PC": "PLUMBING CODE",
    "MC": "MECHANICAL CODE",
    "FGC": "FUEL GAS CODE",
}
CODE_SECTION_IDS = {prefix: index for index, prefix in enumerate(CODE_NAMES, start=1)}


@dataclass(frozen=True)
class SourcePDF:
    file_name: str
    title: str
    prefix: str
    chapter_number: str
    header_line: str
    url: str


@dataclass
class Line:
    text: str
    page: int
    bbox: tuple[float, float, float, float]


@dataclass
class SourceSection:
    prefix: str
    chapter_number: str
    section_number: str
    title: str
    heading_line: Line | None = None
    lines: list[Line] = field(default_factory=list)
    source_pages: list[dict] = field(default_factory=list)
    blocks: list[dict] = field(default_factory=list)
    verified_semantic_text: str | None = None
    semantic_text_recovery: dict | None = None


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._href: str | None = None
        self._text: list[str] = []
        self.links: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        values = dict(attrs)
        self._href = values.get("href")
        self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href is not None:
            self.links.append((self._href, normalized_space(" ".join(self._text))))
            self._href = None
            self._text = []


class ICCSemanticHTMLSanitizer(HTMLParser):
    """Retain code semantics while removing publisher presentation markup."""

    suppressed_tags = {
        "del", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6",
        "img", "script", "style", "table",
    }
    block_tags = {"p", "ol", "ul", "li"}
    inline_tags = {"strong", "em", "sup", "sub"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.output: list[str] = []
        self.text_parts: list[str] = []
        self.stack: list[tuple[str, str | None, bool]] = []
        self.suppression_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").lower().split())
        is_deletion_marker = tag == "span" and any(
            "deletion-marker" in class_name or "deletion_marker" in class_name
            for class_name in classes
        )
        suppressed = (
            self.suppression_depth > 0
            or tag in self.suppressed_tags
            or is_deletion_marker
        )
        if suppressed:
            if tag not in {"br", "img"}:
                self.stack.append((tag, None, True))
                self.suppression_depth += 1
            return
        if tag == "br":
            self.output.append("<br>")
            self.text_parts.append("\n")
            return
        emitted: str | None = None
        if tag in self.block_tags or tag in self.inline_tags:
            emitted = tag
        elif tag == "span":
            if "bold" in classes:
                emitted = "strong"
            elif "italic" in classes:
                emitted = "em"
        if emitted is not None:
            if emitted in {"ol", "ul"}:
                self.output.append(f'<{emitted} class="code-explicit-list">')
            else:
                self.output.append(f"<{emitted}>")
        self.stack.append((tag, emitted, False))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "br" and self.suppression_depth == 0:
            self.output.append("<br>")
            self.text_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if not self.stack:
            return
        stack_index = next(
            (index for index in range(len(self.stack) - 1, -1, -1) if self.stack[index][0] == tag),
            None,
        )
        if stack_index is None:
            return
        closed = self.stack[stack_index:]
        del self.stack[stack_index:]
        for _source_tag, emitted, suppressed in reversed(closed):
            if suppressed:
                self.suppression_depth = max(0, self.suppression_depth - 1)
            elif emitted is not None:
                self.output.append(f"</{emitted}> ")

    def handle_data(self, data: str) -> None:
        if self.suppression_depth:
            return
        value = normalized_space(data)
        if not value:
            return
        self.output.append(f"{html.escape(value)} ")
        self.text_parts.append(value)

    def result(self) -> tuple[str, str]:
        rendered = re.sub(r"\s+", " ", "".join(self.output)).strip()
        rendered = re.sub(
            r"(<(?:p|ol|ul|li|strong|em|sup|sub)(?:\s+[^>]*)?>)\s+",
            r"\1",
            rendered,
        )
        rendered = re.sub(r"\s+</(p|ol|ul|li|strong|em|sup|sub)>", r"</\1>", rendered)
        rendered = re.sub(r"\s+(<br>)\s*", r"\1", rendered)
        rendered = re.sub(r"\s+([,.;:!?])", r"\1", rendered)
        # Retain the printed legal marker inside each item.  The web suppresses
        # browser-generated markers for code-explicit-list, while the native
        # attributed-text renderer needs the authored marker in the text.
        plain_text = re.sub(
            r"\s+([,.;:!?])",
            r"\1",
            normalized_space(" ".join(self.text_parts)),
        )
        return rendered, plain_text


class ICCTableHTMLParser(HTMLParser):
    """Parse ICC's semantic table HTML into publisher-neutral cells."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.caption_parts: list[str] = []
        self.in_caption = False
        self.table_class = ""
        self.in_table = False
        self.rows: list[list[dict]] = []
        self.current_row: list[dict] | None = None
        self.current_cell: dict | None = None
        self.cell_suppression_depth = 0
        self.cell_inline_stack: list[tuple[str, str | None, bool]] = []
        self.in_notes = False
        self.notes_depth = 0
        self.note_parts: list[str] | None = None
        self.footnotes: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").lower().split())
        if tag == "figcaption":
            self.in_caption = True
            return
        if tag == "table":
            self.in_table = True
            self.table_class = attributes.get("class") or ""
            return
        if tag == "div":
            if "table_notes" in classes:
                self.notes_depth = 1
            elif self.notes_depth > 0:
                self.notes_depth += 1
            self.in_notes = self.notes_depth > 0
        if self.in_notes and tag == "p" and self.note_parts is None:
            self.note_parts = []
        if not self.in_table:
            return
        if tag == "tr":
            self.current_row = []
            return
        if tag in {"td", "th"}:
            self.current_cell = {
                "sourceTag": tag,
                "rowSpan": positive_html_integer(attributes.get("rowspan")),
                "columnSpan": positive_html_integer(attributes.get("colspan")),
                "horizontalAlignment": html_alignment(attributes.get("align")),
                "verticalAlignment": html_vertical_alignment(attributes.get("valign")),
                "plainParts": [],
                "htmlParts": [],
                "sourceClass": attributes.get("class") or "",
            }
            self.cell_suppression_depth = 0
            self.cell_inline_stack = []
            return
        if self.current_cell is None:
            return
        suppressed = self.cell_suppression_depth > 0 or tag == "del"
        if suppressed:
            if tag != "br":
                self.cell_inline_stack.append((tag, None, True))
                self.cell_suppression_depth += 1
            return
        if tag == "br":
            self.current_cell["htmlParts"].append("<br>")
            return
        emitted: str | None = None
        if tag in {"strong", "em", "sup", "sub"}:
            emitted = tag
        elif tag == "span":
            if "content_newline_inside_td" in classes:
                if self.current_cell["htmlParts"]:
                    self.current_cell["htmlParts"].append("<br>")
            elif "bold" in classes:
                emitted = "strong"
            elif "italic" in classes:
                emitted = "em"
        if emitted is not None:
            self.current_cell["htmlParts"].append(f"<{emitted}>")
        self.cell_inline_stack.append((tag, emitted, False))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "br" and self.current_cell is not None and not self.cell_suppression_depth:
            self.current_cell["htmlParts"].append("<br>")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "figcaption":
            self.in_caption = False
            return
        if tag == "p" and self.note_parts is not None:
            value = normalized_space(" ".join(self.note_parts))
            if value:
                self.footnotes.append(value)
            self.note_parts = None
        if tag == "table":
            self.in_table = False
            return
        if tag == "div" and self.notes_depth > 0 and not self.in_table:
            self.notes_depth -= 1
            self.in_notes = self.notes_depth > 0
        if tag in {"td", "th"} and self.current_cell is not None:
            self.current_cell["plainText"] = normalized_space(
                " ".join(self.current_cell.pop("plainParts"))
            )
            self.current_cell["plainText"] = re.sub(
                r"\s+([,.;:!?])",
                r"\1",
                self.current_cell["plainText"],
            )
            cell_html = re.sub(r"\s+", " ", "".join(self.current_cell.pop("htmlParts"))).strip()
            cell_html = re.sub(r"<(strong|em|sup|sub)>\s+", r"<\1>", cell_html)
            cell_html = re.sub(r"\s+</(strong|em|sup|sub)>", r"</\1>", cell_html)
            self.current_cell["html"] = cell_html
            if self.current_row is not None:
                self.current_row.append(self.current_cell)
            self.current_cell = None
            self.cell_suppression_depth = 0
            self.cell_inline_stack = []
            return
        if tag == "tr" and self.current_row is not None:
            self.rows.append(self.current_row)
            self.current_row = None
            return
        if self.current_cell is None or not self.cell_inline_stack:
            return
        stack_index = next(
            (
                index for index in range(len(self.cell_inline_stack) - 1, -1, -1)
                if self.cell_inline_stack[index][0] == tag
            ),
            None,
        )
        if stack_index is None:
            return
        closed = self.cell_inline_stack[stack_index:]
        del self.cell_inline_stack[stack_index:]
        for _source_tag, emitted, suppressed in reversed(closed):
            if suppressed:
                self.cell_suppression_depth = max(0, self.cell_suppression_depth - 1)
            elif emitted is not None:
                self.current_cell["htmlParts"].append(f"</{emitted}>")

    def handle_data(self, data: str) -> None:
        value = normalized_space(data)
        if not value:
            return
        if self.in_caption:
            self.caption_parts.append(value)
        if self.note_parts is not None:
            self.note_parts.append(value)
        if self.current_cell is None or self.cell_suppression_depth:
            return
        self.current_cell["plainParts"].append(value)
        parts = self.current_cell["htmlParts"]
        in_compact_inline = any(
            emitted in {"sup", "sub"} and not suppressed
            for _source_tag, emitted, suppressed in self.cell_inline_stack
        )
        if parts and not in_compact_inline and not str(parts[-1]).endswith((">", " ", "<br>")):
            parts.append(" ")
        parts.append(html.escape(value))


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--limit-files", type=int, default=0, help="Fixture/debug use only.")
    parser.add_argument("--pdftotext", type=Path)
    return parser.parse_args()


def normalized_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalized_tokens(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:[.-][a-z0-9]+)*", (value or "").lower())


def semantic_verification_tokens(value: str) -> list[str]:
    """Normalize typography and PDF-attached footnote markers for comparison."""
    # Replace vulgar fractions before NFKD expands them.  The leading space is
    # intentional: ``1½`` in the official PDF and ICC's ``1 1/2`` must
    # produce the same tokens without collapsing to ``11/2``.
    normalized = (value or "").replace("¼", " 1/4").replace("½", " 1/2").replace("¾", " 3/4")
    normalized = unicodedata.normalize("NFKD", normalized)
    normalized = normalized.replace("–", "-").replace("—", "-").replace("⁄", "/")
    normalized = re.sub(
        r"(?<=\d)(?=[A-Za-z])|(?<=[A-Za-z])(?=\d)",
        " ",
        normalized,
    )
    # Poppler joins occupancy labels to superscript table notes (Bc, R-2b),
    # while semantic HTML exposes the note in a separate <sup> element.
    normalized = re.sub(
        r"\b([A-Z](?:-\d+)?)\s*([a-z])\b",
        r"\1 \2",
        normalized,
    )
    return re.findall(r"[a-z0-9]+", normalized.lower())


def contiguous_token_sequence(
    haystack: list[str],
    needle: list[str],
    start: int = 0,
) -> int | None:
    if not needle or len(needle) > len(haystack):
        return None
    for index in range(max(start, 0), len(haystack) - len(needle) + 1):
        if haystack[index:index + len(needle)] == needle:
            return index
    return None


def ordered_token_subsequence(needle: list[str], haystack: list[str]) -> bool:
    """Return true only when every needle token appears in order."""
    if not needle:
        return True
    offset = 0
    for token in haystack:
        if token == needle[offset]:
            offset += 1
            if offset == len(needle):
                return True
    return False


def positive_html_integer(value: str | None) -> int:
    try:
        return max(1, int(value or "1"))
    except ValueError:
        return 1


def html_alignment(value: str | None) -> str | None:
    return {
        "left": "leading",
        "center": "center",
        "right": "trailing",
    }.get((value or "").lower())


def html_vertical_alignment(value: str | None) -> str | None:
    return {
        "top": "top",
        "middle": "middle",
        "bottom": "bottom",
    }.get((value or "").lower())


def parse_icc_heading(value: str) -> tuple[str, str] | None:
    match = re.match(r"^([A-Z]?\d+(?:\.\d+)+)\s+(.+)$", normalized_space(value))
    if match is None:
        return None
    return match.group(1), match.group(2).strip()


def icc_table_cells(rows: list[list[dict]], *, drop_deletion_margin: bool) -> tuple[list[dict], int]:
    raw_rows = []
    for row in rows:
        normalized_row = [dict(cell) for cell in row]
        if drop_deletion_margin and normalized_row:
            normalized_row = normalized_row[1:]
        raw_rows.append(normalized_row)

    occupied_by_row: dict[int, set[int]] = collections.defaultdict(set)
    cells: list[dict] = []
    column_count = 0
    for row_index, row in enumerate(raw_rows):
        column_index = 0
        for source_cell in row:
            while column_index in occupied_by_row[row_index]:
                column_index += 1
            row_span = int(source_cell.get("rowSpan", 1))
            column_span = int(source_cell.get("columnSpan", 1))
            # ICC's 1018.1.1 semantic source says the final heading spans
            # three columns, but both its two child headings and the official
            # NYC PDF establish a two-column span.
            if (
                row_index == 0
                and column_index == 2
                and column_span == 3
                and normalized_space(str(source_cell.get("plainText", ""))).startswith(
                    "REQUIRED FIRE-RESISTANCE RATING"
                )
            ):
                column_span = 2
            for occupied_row in range(row_index, row_index + row_span):
                for occupied_column in range(column_index, column_index + column_span):
                    occupied_by_row[occupied_row].add(occupied_column)
            is_header = (
                source_cell.get("sourceTag") == "th"
                or row_index == 0
                or "<strong>" in str(source_cell.get("html", "")).lower()
            )
            cells.append({
                "row": row_index,
                "column": column_index,
                "rowSpan": row_span,
                "columnSpan": column_span,
                "html": str(source_cell.get("html", "")),
                "plainText": str(source_cell.get("plainText", "")),
                "borders": {
                    "top": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                    "right": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                    "bottom": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                    "left": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                },
                "horizontalAlignment": source_cell.get("horizontalAlignment"),
                "verticalAlignment": source_cell.get("verticalAlignment"),
                "backgroundColorHex": "#F3F4F6" if is_header else None,
                "textColorHex": None,
                "isBold": True if is_header else None,
                "isItalic": None,
                "fontSize": None,
                "isWrapped": True,
            })
            column_index += column_span
            column_count = max(column_count, column_index)
    return cells, column_count


def parse_icc_table_fragment(fragment: str) -> dict | None:
    parser = ICCTableHTMLParser()
    parser.feed(fragment)
    parser.close()
    caption_text = normalized_space(" ".join(parser.caption_parts))
    match = re.search(r"\bTABLE\s+([A-Z0-9.]+)\s*(.*)$", caption_text, re.I)
    if match is None or not parser.rows:
        return None
    reference = match.group(1).upper()
    title = normalized_space(match.group(2))
    cells, column_count = icc_table_cells(
        parser.rows,
        drop_deletion_margin="deletion-marker-table-margin" in parser.table_class,
    )
    return {
        "reference": reference,
        "title": title,
        "caption": f"TABLE {reference}" + (f" — {title}" if title else ""),
        "rowCount": len(parser.rows),
        "columnCount": column_count,
        "cells": cells,
        "footnotes": parser.footnotes,
    }


def load_icc_semantic_snapshot(source_dir: Path, source: SourcePDF) -> dict | None:
    if source.prefix != "BC" or source.chapter_number != "10":
        return None
    path = source_dir / "icc-html" / "bc-10.json"
    if not path.is_file():
        raise FileNotFoundError(
            "Building Code Chapter 10 requires the independently captured ICC semantic "
            f"snapshot at {path}; refusing to rebuild a degraded PDF-only chapter."
        )
    document = json.loads(path.read_text(encoding="utf-8"))
    if document.get("sourceURL") != ICC_2014_BUILDING_CODE_CHAPTER_10_URL:
        raise RuntimeError(f"Unexpected ICC Chapter 10 snapshot URL: {document.get('sourceURL')}")
    section_html: dict[str, dict] = {}
    tables: dict[str, dict] = {}
    for item in document.get("sections", []):
        fragment = str(item.get("html", ""))
        heading = parse_icc_heading(str(item.get("heading", "")))
        if heading is not None:
            section_number, title = heading
            sanitizer = ICCSemanticHTMLSanitizer()
            sanitizer.feed(fragment)
            sanitizer.close()
            semantic_html, semantic_text = sanitizer.result()
            if semantic_html and semantic_text:
                if section_number in section_html:
                    raise RuntimeError(f"Duplicate ICC semantic section {section_number}")
                section_html[section_number] = {
                    "title": title,
                    "html": semantic_html,
                    "plainText": semantic_text,
                    "anchorURL": f"{ICC_2014_BUILDING_CODE_CHAPTER_10_URL}#{section_number}",
                }
        if "<table" in fragment.lower():
            table = parse_icc_table_fragment(fragment)
            if table is None:
                raise RuntimeError("ICC Chapter 10 snapshot contains an unparseable table fragment.")
            if table["reference"] in tables:
                raise RuntimeError(f"Duplicate ICC semantic table {table['reference']}")
            tables[table["reference"]] = table
    expected_tables = set(ICC_BC10_TABLE_PDF_PAGES)
    if set(tables) != expected_tables:
        raise RuntimeError(
            "ICC Chapter 10 table set mismatch: "
            f"missing={sorted(expected_tables - set(tables))}, "
            f"unexpected={sorted(set(tables) - expected_tables)}"
        )
    return {
        "sourceURL": ICC_2014_BUILDING_CODE_CHAPTER_10_URL,
        "sourceSHA256": sha256(path),
        "sectionHTML": section_html,
        "tables": tables,
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def fetch_bytes(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def download(url: str, destination: Path) -> None:
    if destination.exists() and destination.stat().st_size > 0:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".partial")
    temporary.write_bytes(fetch_bytes(url))
    temporary.replace(destination)


def html_links(url: str) -> tuple[list[tuple[str, str]], str]:
    source = fetch_bytes(url).decode("utf-8", errors="replace")
    parser = LinkCollector()
    parser.feed(source)
    return parser.links, hashlib.sha256(source.encode("utf-8")).hexdigest()


def source_from_viewer_link(href: str, title: str) -> SourcePDF | None:
    absolute = urllib.parse.urljoin("https://www.nyc.gov", href)
    parsed = urllib.parse.urlparse(absolute)
    if not parsed.path.endswith("/viewer.html"):
        return None
    query = urllib.parse.parse_qs(parsed.query)
    if query.get("section", [""])[0] != "conscode_2014":
        return None
    file_name = query.get("file", [""])[0]
    match = re.match(r"2014CC_(AC|BC|PC|MC|FGC)_", file_name, re.I)
    if not match:
        return None
    prefix = match.group(1).upper()
    # The official DOB filename for Building Code Chapter 10 is misspelled
    # ``..._Chapte_10_...``.  Accept that exact publisher typo so the complete
    # means-of-egress chapter cannot disappear from the corpus silently.
    chapter_match = re.search(r"Chapte(?:r)?_?(\d+)", file_name, re.I)
    appendix_match = re.search(r"Appendix_?([A-Z])", file_name, re.I)
    if chapter_match:
        chapter_number = chapter_match.group(1)
        header_line = f"CHAPTER {chapter_number}"
    elif appendix_match:
        chapter_number = appendix_match.group(1).upper()
        header_line = f"APPENDIX {chapter_number}"
    else:
        return None
    quoted_name = urllib.parse.quote(file_name, safe="._-()")
    return SourcePDF(
        file_name=file_name,
        title=title or f"{header_line} — {CODE_NAMES[prefix]}",
        prefix=prefix,
        chapter_number=chapter_number,
        header_line=header_line,
        url=PDF_ROOT_URL + quoted_name,
    )


def discover_code_sources() -> tuple[list[SourcePDF], str]:
    links, page_hash = html_links(CODE_PAGE_URL)
    sources = [source_from_viewer_link(href, title) for href, title in links]
    unique = {source.file_name: source for source in sources if source is not None}
    result = sorted(
        unique.values(),
        key=lambda source: (
            list(CODE_NAMES).index(source.prefix),
            0 if source.chapter_number.isdigit() else 1,
            int(source.chapter_number) if source.chapter_number.isdigit() else source.chapter_number,
        ),
    )
    if len(result) < 100:
        raise RuntimeError(f"Official code page yielded only {len(result)} chapter PDFs.")
    discovered_bc_chapters = {
        int(source.chapter_number)
        for source in result
        if source.prefix == "BC" and source.chapter_number.isdigit()
    }
    required_bc_chapters = set(range(1, 36))
    missing_bc_chapters = sorted(required_bc_chapters - discovered_bc_chapters)
    if missing_bc_chapters:
        raise RuntimeError(
            "Official code page is missing required Building Code chapters: "
            + ", ".join(map(str, missing_bc_chapters))
        )
    return result, page_hash


def discover_update_sources() -> tuple[list[tuple[str, str]], str]:
    links, page_hash = html_links(UPDATE_PAGE_URL)
    result: dict[str, str] = {}
    for href, title in links:
        absolute = urllib.parse.urljoin("https://www.nyc.gov", href)
        if not re.search(r"update[_-]?\d+.*\.pdf", absolute, re.I):
            continue
        result[absolute] = title or Path(urllib.parse.urlparse(absolute).path).stem
    return sorted(
        result.items(),
        key=lambda item: int(re.search(r"update[_-]?(\d+)", item[0], re.I).group(1)),
    ), page_hash


def resolved_pdftotext(configured: Path | None) -> str:
    candidates = [
        str(configured) if configured else None,
        shutil.which("pdftotext"),
        "/Users/randy/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftotext",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    raise RuntimeError("Poppler pdftotext is required for independent extraction.")


def poppler_layout_pages(pdf_path: Path, executable: str) -> list[str]:
    completed = subprocess.run(
        [executable, "-layout", str(pdf_path), "-"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    pages = completed.stdout.decode("utf-8", errors="replace").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    return pages


def poppler_bbox_pages(pdf_path: Path, executable: str) -> list[list[dict]]:
    completed = subprocess.run(
        [executable, "-bbox-layout", str(pdf_path), "-"],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    root = ET.fromstring(completed.stdout)
    pages: list[list[dict]] = []
    for page in root.iterfind(".//{*}page"):
        words = []
        for word in page.iterfind(".//{*}word"):
            words.append({
                "text": normalized_space("".join(word.itertext())),
                "x0": float(word.attrib.get("xMin", 0)),
                "y0": float(word.attrib.get("yMin", 0)),
                "x1": float(word.attrib.get("xMax", 0)),
                "y1": float(word.attrib.get("yMax", 0)),
            })
        pages.append(words)
    return pages


def parser_agreement(primary: str, secondary: str) -> float:
    left = collections.Counter(normalized_tokens(primary))
    right = collections.Counter(normalized_tokens(secondary))
    denominator = max(sum(left.values()), sum(right.values()), 1)
    overlap = sum((left & right).values())
    return round(overlap / denominator, 4)


def lines_from_page(page, page_number: int) -> list[Line]:
    words = page.extract_words(
        x_tolerance=1,
        y_tolerance=3,
        keep_blank_chars=False,
        use_text_flow=False,
    )
    rows: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        word_top = float(word["top"])
        word_bottom = float(word["bottom"])
        matching_row: list[dict] | None = None
        matching_distance = float("inf")
        for row in rows[-4:]:
            row_top = min(float(item["top"]) for item in row)
            row_bottom = max(float(item["bottom"]) for item in row)
            overlap = min(row_bottom, word_bottom) - max(row_top, word_top)
            minimum_height = max(min(row_bottom - row_top, word_bottom - word_top), 1.0)
            top_distance = abs(row_top - word_top)
            # Subscripts and superscripts often have a different `top` value
            # even though they visibly overlap the base text.  Treat vertical
            # overlap as the primary line signal so A_e/A_f/F_eo do not fall
            # into later prose rows.
            if top_distance <= 2.75 or overlap / minimum_height >= 0.45:
                if top_distance < matching_distance:
                    matching_row = row
                    matching_distance = top_distance
        if matching_row is None:
            rows.append([word])
        else:
            matching_row.append(word)
    rows.sort(key=lambda row: min(float(item["top"]) for item in row))
    result = []
    for row in rows:
        ordered = sorted(row, key=lambda item: float(item["x0"]))
        text_parts: list[str] = []
        prior_x1: float | None = None
        for item in ordered:
            value = str(item["text"])
            x0 = float(item["x0"])
            separator = ""
            if text_parts and prior_x1 is not None and x0 - prior_x1 > 1.25:
                separator = " "
            text_parts.append(separator + value)
            prior_x1 = float(item["x1"])
        text = normalized_space("".join(text_parts))
        if not text:
            continue
        x0 = min(float(item["x0"]) for item in ordered)
        top = min(float(item["top"]) for item in ordered)
        x1 = max(float(item["x1"]) for item in ordered)
        bottom = max(float(item["bottom"]) for item in ordered)
        if bottom > float(page.height) - 22 and re.fullmatch(r"(?:\d+|[A-Z]+-?\d+)", text):
            continue
        if top < 30 and re.search(r"2014 NEW YORK CITY|CONSTRUCTION CODES", text, re.I):
            continue
        result.append(Line(text=text, page=page_number, bbox=(x0, top, x1, bottom)))
    return result


SECTION_LINE = re.compile(
    r"^(?:§\s*)?(?P<number>(?:28-\d{3,4}|[A-Z]?\d{3,4})(?:\.\s*\d+)+|[A-Z]\.\s*\d+(?:\.\s*\d+)*|[A-Z]\d{3})\s+(?P<tail>.+)$",
    re.I,
)


def section_heading(line: str, prefix: str) -> tuple[str, str, str] | None:
    normalized = normalized_space(line)
    # Consolidated DOB PDFs mark some amended headings with one or more
    # leading asterisks. The marker is amendment metadata, not part of the
    # section number, so retain the accompanying note in prose while parsing
    # the marked legal heading as its own section.
    normalized = re.sub(r"^\*+(?=[A-Z]?\d)", "", normalized)
    match = SECTION_LINE.match(normalized)
    if not match:
        return None
    number = re.sub(r"\.\s+", ".", match.group("number")).upper()
    if prefix == "AC" and not number.startswith("28-"):
        return None
    if prefix != "AC" and number.startswith("28-"):
        return None
    tail = normalized_space(match.group("tail"))
    if not tail or not (tail[0].isupper() or tail[0].isdigit()):
        return None
    if re.fullmatch(r"[A-Z]?\d+(?:\.\d+)*\.?", tail, re.I):
        return None
    title = tail
    inline_body = ""
    period = tail.find(".")
    if 0 <= period <= 180:
        title = tail[: period + 1]
        inline_body = tail[period + 1 :].strip()
    elif len(tail) > 180:
        return None
    return number, title, inline_body


def printed_page_label(lines: list[Line], page_height: float) -> str | None:
    candidates = [line.text for line in lines if line.bbox[3] > page_height - 72]
    for candidate in reversed(candidates):
        match = re.search(r"(?:^|\s)([A-Z]{0,3}-?\d{1,4})(?:\s|$)", candidate)
        if match:
            return match.group(1)
    return None


def bbox_union(lines: Iterable[Line]) -> list[float] | None:
    values = list(lines)
    if not values:
        return None
    return [
        round(min(line.bbox[0] for line in values), 2),
        round(min(line.bbox[1] for line in values), 2),
        round(max(line.bbox[2] for line in values), 2),
        round(max(line.bbox[3] for line in values), 2),
    ]


def region_poppler_text(words: list[dict], bbox: tuple[float, float, float, float]) -> str:
    x0, top, x1, bottom = bbox
    selected = [
        word["text"]
        for word in words
        if word["x1"] >= x0 - 3
        and word["x0"] <= x1 + 3
        and word["y1"] >= top - 3
        and word["y0"] <= bottom + 3
    ]
    return " ".join(selected)


def table_caption(lines: list[Line], bbox: tuple[float, float, float, float]) -> str | None:
    above = [
        line for line in lines
        if 0 <= bbox[1] - line.bbox[3] <= 100
        and re.match(r"^\*?\s*TABLE\s+[A-Z0-9]", line.text, re.I)
    ]
    return above[-1].text if above else None


def table_footnotes(
    lines: list[Line],
    bbox: tuple[float, float, float, float],
) -> tuple[list[str], set[int]]:
    """Return complete table notes and every physical PDF line they occupy.

    Long DOB table notes frequently wrap for several lines and multi-page
    tables can leave more than 135 points between the grid and their final
    note.  Once a note run starts, retain its wrapped lines until the next legal
    section instead of leaking those continuations into the section prose.
    """
    candidates = [
        (index, line)
        for index, line in enumerate(lines)
        if 0 <= line.bbox[1] - bbox[3] <= 360
    ]
    start_offset = next((
        offset
        for offset, (_index, line) in enumerate(candidates)
        if re.match(
            r"^(?:For SI:|[A-Z]{1,4}(?:,\s*[A-Z]{1,4})?\s*=|[a-z*]{1,3}[.):]\s|\d+[.)]\s|Note:)",
            line.text,
            re.I,
        )
    ), None)
    if start_offset is None:
        return [], set()

    note_lines: list[tuple[int, Line]] = []
    for index, line in candidates[start_offset:]:
        normalized = re.sub(r"^\*+(?=[A-Z]?\d)", "", normalized_space(line.text))
        if SECTION_LINE.match(normalized):
            break
        note_lines.append((index, line))

    footnotes: list[str] = []
    for _index, line in note_lines:
        value = normalized_space(line.text)
        starts_note = re.match(
            r"^(?:For SI:|[A-Z]{1,4}(?:,\s*[A-Z]{1,4})?\s*=|[a-z*]{1,3}[.):]\s|\d+[.)]\s|Note:)",
            value,
            re.I,
        )
        if starts_note or not footnotes:
            footnotes.append(value)
        else:
            footnotes[-1] = normalized_space(f"{footnotes[-1]} {value}")
    return footnotes, {index for index, _line in note_lines}


def table_payload(
    table_id: str,
    rows: list[list[str | None]],
    caption: str | None,
    footnotes: list[str],
    source: SourcePDF,
    source_hash: str,
    page_number: int,
    bbox: tuple[float, float, float, float],
) -> dict:
    column_count = max((len(row) for row in rows), default=0)
    cells = []
    for row_index, row in enumerate(rows):
        for column_index in range(column_count):
            value = normalized_space(row[column_index] or "") if column_index < len(row) else ""
            cells.append({
                "row": row_index,
                "column": column_index,
                "rowSpan": 1,
                "columnSpan": 1,
                "html": html.escape(value).replace("\n", "<br>"),
                "plainText": value,
                "borders": {
                    "top": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                    "right": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                    "bottom": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                    "left": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
                },
                "horizontalAlignment": None,
                "verticalAlignment": None,
                "backgroundColorHex": "#F3F4F6" if row_index == 0 else None,
                "textColorHex": None,
                "isBold": True if row_index == 0 else None,
                "isItalic": None,
                "fontSize": None,
                "isWrapped": True,
            })
    return {
        "id": table_id,
        "caption": caption,
        "sourceWorkbookPath": source.file_name,
        "sourceSheetName": f"PDF page {page_number}",
        "sourceRange": ",".join(str(round(value, 2)) for value in bbox),
        "columnCount": column_count,
        "rowCount": len(rows),
        "columnWidths": None,
        "rowHeights": None,
        "cells": cells,
        "footnotes": footnotes,
        "officialPDFProvenance": {
            "sourceURL": source.url,
            "sourceSHA256": source_hash,
            "pdfPage": page_number,
            "bbox": [round(value, 2) for value in bbox],
            "extraction": "pdfplumber-grid verified against Poppler bbox text",
        },
    }


def structured_table_html(table: dict) -> str:
    cells_by_row: dict[int, list[dict]] = collections.defaultdict(list)
    for cell in table.get("cells", []):
        cells_by_row[int(cell.get("row", 0))].append(cell)
    body_rows = []
    for row_index in range(int(table.get("rowCount", 0))):
        row_cells = []
        for cell in sorted(cells_by_row.get(row_index, []), key=lambda value: int(value.get("column", 0))):
            tag = "th" if row_index == 0 or cell.get("isBold") is True else "td"
            attributes = []
            if tag == "th":
                attributes.append('scope="col"')
            if int(cell.get("rowSpan", 1)) > 1:
                attributes.append(f'rowspan="{int(cell["rowSpan"])}"')
            if int(cell.get("columnSpan", 1)) > 1:
                attributes.append(f'colspan="{int(cell["columnSpan"])}"')
            attribute_text = f" {' '.join(attributes)}" if attributes else ""
            row_cells.append(f"<{tag}{attribute_text}>{cell.get('html', '')}</{tag}>")
        body_rows.append(f"<tr>{''.join(row_cells)}</tr>")
    caption = table.get("caption")
    caption_content = table.get("captionHTML") or (html.escape(caption) if caption else "")
    caption_html = f"<caption>{caption_content}</caption>" if caption_content else ""
    footnotes = "".join(
        f"<p class=\"code-table-footnote\">{html.escape(value)}</p>"
        for value in table.get("footnotes", [])
        if value
    )
    return (
        f'<table data-table-id="{html.escape(str(table.get("id", "")))}">'
        f"{caption_html}<tbody>{''.join(body_rows)}</tbody></table>{footnotes}"
    )


def curated_table_cell(
    row: int,
    column: int,
    plain_text: str,
    cell_html: str | None = None,
    *,
    row_span: int = 1,
    is_header: bool = False,
) -> dict:
    return {
        "row": row,
        "column": column,
        "rowSpan": row_span,
        "columnSpan": 1,
        "html": cell_html if cell_html is not None else html.escape(plain_text),
        "plainText": plain_text,
        "borders": {
            "top": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
            "right": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
            "bottom": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
            "left": {"isHidden": False, "style": "solid", "width": 1, "colorHex": "#9CA3AF"},
        },
        "horizontalAlignment": None,
        "verticalAlignment": "middle",
        "backgroundColorHex": "#F3F4F6" if is_header else None,
        "textColorHex": None,
        "isBold": True if is_header else None,
        "isItalic": None,
        "fontSize": None,
        "isWrapped": True,
    }


def curated_bc_table_705_8(source: SourcePDF, source_hash: str) -> dict:
    """Complete Table 705.8, transcribed from semantic HTML and PDF-verified.

    ICC Digital Codes preserves the table's row spans and superscripts.  Every
    emitted cell and note below was compared with the official consolidated DOB
    PDF on pages 9-10; the PDF remains the authoritative provenance.
    """
    table_id = f"{TABLE_ID_PREFIX}-bc-7-705-8"
    cells = [
        curated_table_cell(0, 0, "FIRE SEPARATION DISTANCE (feet)", is_header=True),
        curated_table_cell(0, 1, "DEGREE OF OPENING PROTECTION", is_header=True),
        curated_table_cell(
            0,
            2,
            "ALLOWABLE AREA (a)",
            "ALLOWABLE AREA<sup>a</sup>",
            is_header=True,
        ),
    ]
    groups = [
        (
            "0 to less than 3 (b, c)",
            "0 to less than 3<sup>b, c</sup>",
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "Not Permitted", None),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "Not Permitted", None),
                ("Protected (P)", None, "Not Permitted (j, k)", "Not Permitted<sup>j, k</sup>"),
            ],
        ),
        (
            "3 to less than 5 (d, e)",
            "3 to less than 5<sup>d, e</sup>",
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "Not Permitted", None),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "15%", None),
                ("Protected (P)", None, "15% (l)", "15%<sup>l</sup>"),
            ],
        ),
        (
            "5 to less than 10 (e, f)",
            "5 to less than 10<sup>e, f</sup>",
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "10% (h)", "10%<sup>h</sup>"),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "25%", None),
                ("Protected (P)", None, "25% (l)", "25%<sup>l</sup>"),
            ],
        ),
        (
            "10 to less than 15 (e, f, g)",
            "10 to less than 15<sup>e, f, g</sup>",
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "15% (h)", "15%<sup>h</sup>"),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "45%", None),
                ("Protected (P)", None, "45% (l)", "45%<sup>l</sup>"),
            ],
        ),
        (
            "15 to less than 20 (f, g)",
            "15 to less than 20<sup>f, g</sup>",
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "25%", None),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "75%", None),
                ("Protected (P)", None, "75% (l)", "75%<sup>l</sup>"),
            ],
        ),
        (
            "20 to less than 25 (f, g)",
            "20 to less than 25<sup>f, g</sup>",
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "45%", None),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "No Limit", None),
                ("Protected (P)", None, "No Limit (l)", "No Limit<sup>l</sup>"),
            ],
        ),
        (
            "25 to less than 30 (f, g)",
            "25 to less than 30<sup>f, g</sup>",
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "70%", None),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "No Limit", None),
                ("Protected (P)", None, "No Limit (l)", "No Limit<sup>l</sup>"),
            ],
        ),
        (
            "30 or greater",
            None,
            [
                ("Unprotected, Nonsprinklered (UP, NS)", None, "No Limit", None),
                ("Unprotected, Sprinklered (UP, S) (i)", "Unprotected, Sprinklered (UP, S)<sup>i</sup>", "Not Required", None),
                ("Protected (P)", None, "Not Required", None),
            ],
        ),
    ]
    for group_index, (distance, distance_html, rows) in enumerate(groups):
        first_row = 1 + group_index * 3
        cells.append(curated_table_cell(first_row, 0, distance, distance_html, row_span=3))
        for row_offset, (protection, protection_html, area, area_html) in enumerate(rows):
            row_index = first_row + row_offset
            cells.append(curated_table_cell(row_index, 1, protection, protection_html))
            cells.append(curated_table_cell(row_index, 2, area, area_html))

    footnotes = [
        "For SI: 1 foot = 304.8 mm.",
        "UP, NS = Unprotected openings in buildings not equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.1.",
        "UP, S = Unprotected openings in buildings equipped throughout with an automatic sprinkler system in accordance with Section 903.3.1.1.",
        "P = Openings protected with an opening protective assembly in accordance with Section 705.8.2.",
        "a. Values indicated are the percentage of the area of the exterior wall, per story.",
        "b. For the requirements for fire walls of buildings with differing heights, see Section 706.6.",
        "c. For openings in a fire wall for buildings on the same tax lot, see Section 706.8.",
        "d. The maximum percentage of unprotected and protected openings shall be 25 percent for Group R-3 occupancies.",
        "e. Unprotected openings shall not be permitted for openings with a fire separation distance of less than 15 feet for Group H-2 and H-3 occupancies.",
        "f. The area of unprotected and protected openings shall not be limited for Group R-3 occupancies, as applicable in Section 101.2, with a fire separation distance of 5 feet or more.",
        "g. The area of openings in an open parking structure with a fire separation distance of 10 feet or greater shall not be limited.",
        "h. Includes buildings accessory to Group R-3.",
        "i. Not applicable to Group H-1, H-2 and H-3 occupancies.",
        "j. Protected openings through a wall or walls between buildings shall comply with Section 705.8.",
        "k. Protected openings within a fire separation distance of 3 feet or less are permitted for Occupancy Groups R-2 and R-3 provided such openings do not exceed 10 percent of the area of the façade of the story in which they are located. These openings shall not be credited towards meeting any mandatory natural light or ventilation requirements unless they also comply with applicable provisions of Chapter 12 and the Zoning Resolution.",
        "l. In Group R-2 and R-3 occupancies with an exterior separation distance greater than 3 feet, openings shall be in accordance with percentages indicated as “Protected Classification of Opening” in Table 705.8. However, such openings shall not be required to be protected.",
        "m. Upon special application, the commissioner may permit exterior wall openings to be constructed in excess of the permitted area established by Table 705.8 provided that such openings are protected and provided that at the time of their construction they are located at least 60 feet in a direct line, measured at any angle, including vertically and horizontally, from any neighboring building, unless otherwise permitted by Section 705.3 for buildings on the same tax lot. The construction class of the neighboring building shall not be factored into the measurement of the distance between the openings and adjoining building. If any neighboring building is later altered or constructed to come within the above distance limitation, the affected exterior openings shall immediately be closed with construction meeting the fire-resistance-rating requirements for exterior wall construction of the building in which they are located. Such additional openings shall not be credited toward meeting any of the mandatory natural light or ventilation requirements unless they also comply with applicable provisions of Chapter 12 and the New York City Zoning Resolution.",
    ]
    return {
        "id": table_id,
        "caption": "TABLE 705.8 — MAXIMUM AREA OF EXTERIOR WALL OPENINGS BASED ON FIRE SEPARATION DISTANCE AND DEGREE OF OPENING PROTECTION (m)",
        "captionHTML": "TABLE 705.8<br>MAXIMUM AREA OF EXTERIOR WALL OPENINGS BASED ON FIRE SEPARATION DISTANCE AND DEGREE OF OPENING PROTECTION<sup>m</sup>",
        "sourceWorkbookPath": source.file_name,
        "sourceSheetName": "Official PDF pages 9-10",
        "sourceRange": "page 9: 42.48,592.30,569.62,715.78; page 10: 42.48,72.12,569.62,432.43",
        "columnCount": 3,
        "rowCount": 25,
        "columnWidths": None,
        "rowHeights": None,
        "cells": cells,
        "footnotes": footnotes,
        "officialPDFProvenance": {
            "sourceURL": source.url,
            "sourceSHA256": source_hash,
            "pdfPages": [9, 10],
            "bboxes": [
                [42.48, 592.30, 569.62, 715.78],
                [42.48, 72.12, 569.62, 432.43],
            ],
            "extraction": "ICC semantic table transcribed and verified cell-by-cell against official NYC DOB PDF pages 9-10",
        },
        "htmlStructureReference": {
            "publisher": "International Code Council",
            "url": f"{ICC_2014_BUILDING_CODE_CHAPTER_7_URL}#NYNYCBC2014P1_Ch07_Sec705.8",
            "role": "secondary semantic structure reference",
        },
    }


def safe_asset_name(prefix: str, chapter: str, page: int, kind: str, ordinal: int) -> str:
    return f"2014-{prefix.lower()}-{chapter.lower()}-p{page:04d}-{kind}-{ordinal:02d}.png"


def render_crop(
    page,
    bbox: tuple[float, float, float, float],
    path: Path,
    *,
    bottom_margin: float | None = None,
) -> None:
    margin = 8
    resolved_bottom_margin = margin if bottom_margin is None else bottom_margin
    cropped = page.crop((
        max(0, bbox[0] - margin),
        max(0, bbox[1] - margin),
        min(float(page.width), bbox[2] + margin),
        min(float(page.height), bbox[3] + resolved_bottom_margin),
    ))
    image = cropped.to_image(resolution=180, antialias=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")


def add_page_provenance(
    sections: list[SourceSection],
    page_lines: list[Line],
    page_number: int,
    page_height: float,
    agreement: float,
    source: SourcePDF,
    source_hash: str,
) -> None:
    for section in sections:
        relevant = [line for line in section.lines if line.page == page_number]
        if section.heading_line is not None and section.heading_line.page == page_number:
            relevant.insert(0, section.heading_line)
        if not relevant:
            continue
        section.source_pages.append({
            "sourcePDF": source.file_name,
            "sourceURL": source.url,
            "sourceSHA256": source_hash,
            "pdfPage": page_number,
            "printedPageLabel": printed_page_label(page_lines, page_height),
            "contentBBox": bbox_union(relevant),
            "parserAgreement": agreement,
        })


def sections_from_lines(source: SourcePDF, pages: list[list[Line]]) -> list[SourceSection]:
    sections: list[SourceSection] = []
    seen_numbers: set[str] = set()
    active: SourceSection | None = None
    skip_banner_title = False
    for page_lines in pages:
        for line in page_lines:
            normalized = normalized_space(line.text)
            if re.fullmatch(
                rf"\**SECTION\s+{re.escape(source.prefix)}\s+[A-Z0-9.-]+",
                normalized,
                re.I,
            ):
                skip_banner_title = True
                continue
            if skip_banner_title:
                skip_banner_title = False
                if (
                    normalized
                    and normalized.upper() == normalized
                    and section_heading(normalized, source.prefix) is None
                ):
                    continue
            heading = section_heading(line.text, source.prefix)
            if heading:
                number, title, inline_body = heading
                if number in seen_numbers:
                    if active is not None:
                        active.lines.append(line)
                    continue
                seen_numbers.add(number)
                active = SourceSection(
                    prefix=source.prefix,
                    chapter_number=source.chapter_number,
                    section_number=number,
                    title=title,
                    heading_line=line,
                )
                sections.append(active)
                if inline_body:
                    active.lines.append(Line(inline_body, line.page, line.bbox))
                continue
            if active is not None:
                active.lines.append(line)
    # A reserved section has no enacted body.  PDF reading order can otherwise
    # attach a preceding multipage table's continuation rows or footnotes to
    # the reserved heading on a later page.
    for section in sections:
        normalized_title = normalized_space(section.title).strip(" .[]()").lower()
        if normalized_title == "reserved":
            section.lines = []
    return sections


def likely_figure_regions(
    page,
    lines: list[Line],
) -> list[tuple[str, tuple[float, float, float, float], str, list[float] | None, list[float] | None, float, list[int]]]:
    result = []
    page_width = float(page.width)
    page_height = float(page.height)
    pdf_images = [
        (
            max(0.0, float(image.get("x0", 0))),
            max(0.0, float(image.get("top", 0))),
            min(page_width, float(image.get("x1", 0))),
            min(page_height, float(image.get("bottom", 0))),
        )
        for image in page.images
        if float(image.get("x1", 0)) > float(image.get("x0", 0))
        and float(image.get("bottom", 0)) > float(image.get("top", 0))
    ]
    used_images: set[int] = set()
    prior_figure_bottom = 36.0
    for index, line in enumerate(lines):
        if not re.match(r"^\*?\s*FIGURE\s+[A-Z0-9.-]+", line.text, re.I):
            continue
        caption_bottom = line.bbox[3]
        caption_line_indexes = [index]
        for following_index, following in enumerate(lines[index + 1:index + 3], start=index + 1):
            gap = following.bbox[1] - caption_bottom
            if gap > 15 or not re.fullmatch(r"[A-Z0-9\s—–.,()/-]+", following.text):
                break
            caption_line_indexes.append(following_index)
            caption_bottom = following.bbox[3]
        candidates = []
        for image_index, image_bbox in enumerate(pdf_images):
            if image_index in used_images:
                continue
            _x0, top, _x1, bottom = image_bbox
            if line.bbox[1] < top - 8 or line.bbox[1] > bottom + 42:
                continue
            distance = 0 if line.bbox[1] <= bottom else line.bbox[1] - bottom
            candidates.append((distance, abs((top + bottom) / 2 - line.bbox[1]), image_index, image_bbox))
        if candidates:
            _distance, _center_distance, image_index, source_image_bbox = min(candidates)
            used_images.add(image_index)
            image_bbox = source_image_bbox
            crop_method = "embedded-pdf-image-bbox"
            # Some official PDFs give an embedded image a trailing white box
            # that overlaps the first heading of the next legal section. Keep
            # the complete figure and its caption, but do not rasterize that
            # unrelated enacted text into the image shown by the Reader.
            next_section_top = next((
                following.bbox[1]
                for following in lines[caption_line_indexes[-1] + 1:]
                if SECTION_LINE.match(re.sub(r"^\*+(?=[A-Z]?\d)", "", normalized_space(following.text)))
                and following.bbox[1] > caption_bottom
                and following.bbox[1] < source_image_bbox[3]
            ), None)
            if next_section_top is not None:
                clipped_bottom = max(caption_bottom, next_section_top - 2.0)
                image_bbox = (
                    source_image_bbox[0],
                    source_image_bbox[1],
                    source_image_bbox[2],
                    clipped_bottom,
                )
                crop_method = "embedded-pdf-image-bbox-clipped-at-next-section"
            top = max(0.0, image_bbox[1])
            bottom = min(page_height, max(image_bbox[3], caption_bottom))
            bbox = (
                max(0.0, min(36.0, image_bbox[0], line.bbox[0])),
                top,
                min(page_width, max(page_width - 36.0, image_bbox[2], line.bbox[2])),
                bottom,
            )
            result.append((
                line.text,
                bbox,
                crop_method,
                [round(value, 2) for value in image_bbox],
                [round(value, 2) for value in source_image_bbox],
                line.bbox[1],
                caption_line_indexes,
            ))
            prior_figure_bottom = bottom
            continue
        bottom = min(page_height - 30, caption_bottom + 8)
        top = max(36.0, prior_figure_bottom, bottom - 520)
        if bottom - top < 80:
            top = max(36.0, bottom - 240)
        result.append((
            line.text,
            (36.0, top, page_width - 36.0, bottom),
            "caption-region-fallback",
            None,
            None,
            line.bbox[1],
            caption_line_indexes,
        ))
        prior_figure_bottom = bottom
    return result


def attach_block_for_page(sections: list[SourceSection], page_number: int, top: float, block: dict) -> bool:
    caption = normalized_space(str(block.get("caption", "")))
    caption_reference = re.search(
        r"\b(?:FIGURE|TABLE)\s+([A-Z]?\d+(?:\.\d+)+)",
        caption,
        re.I,
    )
    if caption_reference:
        referenced_number = caption_reference.group(1).upper()
        referenced_section = next(
            (
                section for section in sections
                if section.section_number.upper() == referenced_number
            ),
            None,
        )
        if referenced_section is not None:
            referenced_section.blocks.append(block)
            return True
    candidates = []
    for section in sections:
        page_lines = [line for line in section.lines if line.page == page_number and line.bbox[1] <= top]
        if page_lines:
            candidates.append((max(line.bbox[1] for line in page_lines), section))
    if not candidates:
        candidates = [
            (max((line.page for line in section.lines), default=0), section)
            for section in sections
            if any(line.page <= page_number for line in section.lines)
        ]
    if not candidates:
        return False
    candidates.sort(key=lambda item: item[0])
    candidates[-1][1].blocks.append(block)
    return True


def apply_curated_pdf_structure_overrides(
    source: SourcePDF,
    source_hash: str,
    sections: list[SourceSection],
    structured_tables: list[dict],
    discrepancies: list[dict],
    assets_dir: Path,
) -> None:
    """Replace known PDF page-boundary artifacts with verified structures."""
    if source.prefix != "BC" or source.chapter_number != "7":
        return

    partial_table_asset = "2014-bc-7-p0009-table-review-01.png"
    continuation_table_id = f"{TABLE_ID_PREFIX}-bc-7-p0010-01"
    curated_table_id = f"{TABLE_ID_PREFIX}-bc-7-705-8"
    for section in sections:
        section.blocks = [
            block
            for block in section.blocks
            if block.get("imageID") != partial_table_asset
            and block.get("tableID") not in {continuation_table_id, curated_table_id}
        ]
        # Defensive cleanup for older PDF extraction behavior.  Table 705.8's
        # title and wrapped notes belong to the table block, not Section 705.8.6.
        if section.section_number == "705.8.6":
            leaked_table_index = next((
                index
                for index, line in enumerate(section.lines)
                if line.text.startswith("MAXIMUM AREA OF EXTERIOR WALL OPENINGS")
            ), None)
            if leaked_table_index is not None:
                section.lines = section.lines[:leaked_table_index]
                legal_pages = {
                    line.page for line in section.lines
                } | ({section.heading_line.page} if section.heading_line is not None else set())
                section.source_pages = [
                    record
                    for record in section.source_pages
                    if record.get("pdfPage") in legal_pages
                ]

    structured_tables[:] = [
        table
        for table in structured_tables
        if table.get("id") not in {continuation_table_id, curated_table_id}
    ]
    discrepancies[:] = [
        record
        for record in discrepancies
        if not (
            record.get("kind") == "unverified-table"
            and record.get("asset") == partial_table_asset
        )
    ]
    partial_asset_path = assets_dir / partial_table_asset
    if partial_asset_path.is_file():
        partial_asset_path.unlink()

    target = next((section for section in sections if section.section_number == "705.8"), None)
    if target is None:
        discrepancies.append({
            "kind": "curated-structure-target-missing",
            "sourcePDF": source.file_name,
            "sourceSHA256": source_hash,
            "sectionNumber": "705.8",
            "reviewRequired": True,
            "researchClaimEligible": False,
        })
        return

    table = curated_bc_table_705_8(source, source_hash)
    structured_tables.append(table)
    table_plain_text = "\n".join(
        [
            str(table.get("caption", "")),
            *[
                str(cell.get("plainText", ""))
                for cell in table.get("cells", [])
                if cell.get("plainText")
            ],
            *table.get("footnotes", []),
        ]
    )
    target.blocks.append({
        "id": f"{curated_table_id}-block",
        "kind": "table",
        "tableID": curated_table_id,
        "caption": table["caption"],
        "html": structured_table_html(table),
        "plainText": table_plain_text,
        "reviewRequired": False,
        "researchClaimEligible": True,
        "verificationStatus": "cell-by-cell-verified-against-official-pdf",
        "officialPDFProvenance": table["officialPDFProvenance"],
        "htmlStructureReference": table["htmlStructureReference"],
    })


def apply_icc_semantic_tables(
    source: SourcePDF,
    source_hash: str,
    sections: list[SourceSection],
    structured_tables: list[dict],
    discrepancies: list[dict],
    assets_dir: Path,
    poppler_pages: list[str],
    semantic_snapshot: dict | None,
) -> dict:
    if semantic_snapshot is None:
        return {"tableCount": 0, "correctedCellCount": 0}

    prior_table_ids = {
        str(table.get("id"))
        for table in structured_tables
        if table.get("sourceWorkbookPath") == source.file_name
    }
    prior_unverified_assets = {
        str(record.get("asset"))
        for record in discrepancies
        if record.get("kind") == "unverified-table"
        and record.get("sourcePDF") == source.file_name
        and record.get("asset")
    }
    for section in sections:
        section.blocks = [
            block
            for block in section.blocks
            if block.get("tableID") not in prior_table_ids
            and block.get("imageID") not in prior_unverified_assets
        ]
    structured_tables[:] = [
        table
        for table in structured_tables
        if table.get("id") not in prior_table_ids
    ]
    discrepancies[:] = [
        record
        for record in discrepancies
        if not (
            record.get("kind") == "unverified-table"
            and record.get("sourcePDF") == source.file_name
        )
    ]
    for asset_name in prior_unverified_assets:
        asset_path = assets_dir / asset_name
        if asset_path.is_file():
            asset_path.unlink()

    corrected_cell_count = 0
    for reference, source_table in semantic_snapshot["tables"].items():
        table = json.loads(json.dumps(source_table))
        semantic_corrections = []
        if reference == "1004.1.1":
            official_capacity_note = (
                "C*-capacity of all passenger vehicles that can be unloaded simultaneously."
            )
            if official_capacity_note not in table["footnotes"]:
                table["footnotes"].insert(0, official_capacity_note)
                semantic_corrections.append({
                    "part": "table footnote",
                    "semanticHTMLValue": "omitted",
                    "officialPDFValue": official_capacity_note,
                    "resolution": "official NYC DOB PDF controls",
                })
            target_section = next(
                (section for section in sections if section.section_number == reference),
                None,
            )
            if target_section is not None:
                target_section.lines = [
                    line for line in target_section.lines
                    if not normalized_space(line.text).startswith("C*-capacity")
                ]
        if reference == "1018.1.1":
            semantic_corrections.append({
                "part": "required fire-resistance rating heading",
                "semanticHTMLValue": "columnSpan 3",
                "officialPDFValue": "columnSpan 2",
                "resolution": "official NYC DOB PDF and two child headings control",
            })
        if reference == "1028.10.1":
            cells_by_row: dict[int, list[dict]] = collections.defaultdict(list)
            for cell in table["cells"]:
                cells_by_row[int(cell["row"])].append(cell)
            correction_applied = False
            for cells in cells_by_row.values():
                if not any(cell.get("plainText") == "10,000" for cell in cells):
                    continue
                incorrect = next(
                    (cell for cell in cells if cell.get("plainText") == "7"),
                    None,
                )
                if incorrect is not None:
                    incorrect["plainText"] = "17"
                    incorrect["html"] = "17"
                    correction_applied = True
                    corrected_cell_count += 1
                    semantic_corrections.append({
                        "cell": "10,000 seats / maximum seats per row",
                        "semanticHTMLValue": "7",
                        "officialPDFValue": "17",
                        "resolution": "official NYC DOB PDF controls",
                    })
            if not correction_applied:
                raise RuntimeError(
                    "Expected ICC Table 1028.10.1 value 7 was not found for official-PDF correction."
                )

        pdf_pages = ICC_BC10_TABLE_PDF_PAGES[reference]
        if any(page_number < 1 or page_number > len(poppler_pages) for page_number in pdf_pages):
            raise RuntimeError(f"Official PDF page map is invalid for Table {reference}: {pdf_pages}")
        official_counter = collections.Counter(semantic_verification_tokens(" ".join(
            poppler_pages[page_number - 1] for page_number in pdf_pages
        )))
        semantic_values = [
            str(cell.get("plainText", ""))
            for cell in table["cells"]
            if cell.get("plainText")
        ] + [
            str(value) for value in table.get("footnotes", []) if value
        ]
        semantic_counter = collections.Counter(semantic_verification_tokens(" ".join(semantic_values)))
        missing_tokens = semantic_counter - official_counter
        if missing_tokens:
            raise RuntimeError(
                f"ICC Table {reference} does not reconcile with the official DOB PDF: "
                f"{dict(missing_tokens.most_common(8))}"
            )
        for cell in table["cells"]:
            cell_counter = collections.Counter(
                semantic_verification_tokens(str(cell.get("plainText", "")))
            )
            if cell_counter - official_counter:
                raise RuntimeError(
                    f"ICC Table {reference} cell is absent from the official DOB PDF: "
                    f"{cell.get('plainText')}"
                )

        table_id = f"{TABLE_ID_PREFIX}-bc-10-{reference.replace('.', '-')}"
        table.update({
            "id": table_id,
            "sourceWorkbookPath": source.file_name,
            "sourceSheetName": "Official PDF page" + ("s" if len(pdf_pages) > 1 else "")
            + " " + "-".join(str(page) for page in pdf_pages),
            "sourceRange": None,
            "columnWidths": None,
            "rowHeights": None,
            "officialPDFProvenance": {
                "sourceURL": source.url,
                "sourceSHA256": source_hash,
                "pdfPage": pdf_pages[0],
                "pdfPages": pdf_pages,
                "extraction": (
                    "ICC semantic grid independently reconciled cell-by-cell and as a complete "
                    "token set against Poppler text from the official NYC DOB PDF"
                ),
            },
            "htmlStructureReference": {
                "publisher": "International Code Council",
                "url": f"{semantic_snapshot['sourceURL']}#{reference}",
                "sourceSHA256": semantic_snapshot["sourceSHA256"],
                "role": "secondary semantic structure reference",
            },
            "verificationStatus": "cell-by-cell-verified-against-official-pdf",
            "semanticCorrections": semantic_corrections,
        })
        structured_tables.append(table)
        target = next(
            (section for section in sections if section.section_number == reference),
            None,
        )
        if target is None:
            raise RuntimeError(f"No Reader section exists for verified Table {reference}")
        table_plain_text = "\n".join([
            str(table.get("caption", "")),
            *semantic_values,
        ])
        target.blocks.append({
            "id": f"{table_id}-block",
            "kind": "table",
            "tableID": table_id,
            "caption": table["caption"],
            "html": structured_table_html(table),
            "plainText": table_plain_text,
            "reviewRequired": False,
            "researchClaimEligible": True,
            "verificationStatus": table["verificationStatus"],
            "officialPDFProvenance": table["officialPDFProvenance"],
            "htmlStructureReference": table["htmlStructureReference"],
        })
    return {
        "tableCount": len(semantic_snapshot["tables"]),
        "correctedCellCount": corrected_cell_count,
    }


def apply_pdf_verified_semantic_section_recoveries(
    source: SourcePDF,
    source_hash: str,
    sections: list[SourceSection],
    poppler_pages: list[str],
    semantic_snapshot: dict | None,
) -> int:
    """Recover prose hidden by a PDF table detector, without trusting ICC text.

    A recovery is deliberately narrow.  The PDF-derived text must be materially
    shorter, every surviving token must occur in order in the semantic passage,
    and the *complete* semantic passage must occur contiguously after the exact
    section heading on the official DOB PDF pages assigned to that section.
    ICC supplies list/paragraph structure; the DOB PDF independently proves the
    words.  Anything that fails one of these gates remains a fail-closed fallback.
    """
    if semantic_snapshot is None:
        return 0

    recovered_count = 0
    for section_index, section in enumerate(sections):
        semantic_section = semantic_snapshot.get("sectionHTML", {}).get(
            section.section_number
        )
        if semantic_section is None:
            continue
        current_text = source_text(section)
        current_tokens = semantic_verification_tokens(current_text)
        semantic_text = str(semantic_section.get("plainText", ""))
        semantic_tokens = semantic_verification_tokens(semantic_text)
        if (
            len(current_tokens) < 12
            or len(semantic_tokens) < 24
            or len(semantic_tokens) < len(current_tokens) * 1.2
            or not ordered_token_subsequence(current_tokens, semantic_tokens)
        ):
            continue

        page_numbers = sorted({
            int(record["pdfPage"])
            for record in section.source_pages
            if isinstance(record.get("pdfPage"), int)
        })
        if (
            not page_numbers
            or any(page < 1 or page > len(poppler_pages) for page in page_numbers)
        ):
            continue
        official_tokens = semantic_verification_tokens(" ".join(
            poppler_pages[page - 1] for page in page_numbers
        ))
        heading_tokens = semantic_verification_tokens(
            f"{section.section_number} {section.title}"
        )
        heading_index = contiguous_token_sequence(official_tokens, heading_tokens)
        if heading_index is None:
            continue
        passage_index = contiguous_token_sequence(
            official_tokens,
            semantic_tokens,
            heading_index + len(heading_tokens),
        )
        if passage_index is None:
            continue

        next_heading_index: int | None = None
        if section_index + 1 < len(sections):
            next_section = sections[section_index + 1]
            next_heading_tokens = semantic_verification_tokens(
                f"{next_section.section_number} {next_section.title}"
            )
            next_heading_index = contiguous_token_sequence(
                official_tokens,
                next_heading_tokens,
                heading_index + len(heading_tokens),
            )
        if (
            next_heading_index is not None
            and passage_index + len(semantic_tokens) > next_heading_index
        ):
            continue

        section.verified_semantic_text = semantic_text
        section.semantic_text_recovery = {
            "verificationStatus": (
                "complete-semantic-passage-token-verified-against-official-pdf"
            ),
            "previousPDFDerivedTokenCount": len(current_tokens),
            "recoveredTokenCount": len(semantic_tokens),
            "officialPDFProvenance": {
                "sourceURL": source.url,
                "sourceSHA256": source_hash,
                "pdfPages": page_numbers,
                "extraction": (
                    "Complete semantic passage matched contiguously after the exact "
                    "section heading in Poppler text from the official NYC DOB PDF"
                ),
            },
            "htmlStructureReference": {
                "publisher": "International Code Council",
                "url": semantic_section["anchorURL"],
                "sourceSHA256": semantic_snapshot["sourceSHA256"],
                "role": "secondary semantic structure reference",
            },
        }
        recovered_count += 1
    return recovered_count


def extract_source(
    source: SourcePDF,
    pdf_path: Path,
    pdftotext: str,
    assets_dir: Path,
    semantic_snapshot: dict | None = None,
) -> tuple[list[SourceSection], list[dict], list[dict], dict]:
    source_hash = sha256(pdf_path)
    poppler_pages = poppler_layout_pages(pdf_path, pdftotext)
    poppler_bbox = poppler_bbox_pages(pdf_path, pdftotext)
    page_lines: list[list[Line]] = []
    page_meta: list[dict] = []
    discrepancies: list[dict] = []
    structured_tables: list[dict] = []
    pending_visuals: list[tuple[int, float, dict]] = []

    with pdfplumber.open(pdf_path) as pdf:
        if len(poppler_pages) != len(pdf.pages):
            discrepancies.append({
                "kind": "page-count-mismatch",
                "sourcePDF": source.file_name,
                "pdfplumberPages": len(pdf.pages),
                "popplerPages": len(poppler_pages),
                "reviewRequired": True,
            })
        for page_index, page in enumerate(pdf.pages):
            page_number = page_index + 1
            lines = lines_from_page(page, page_number)
            primary_text = "\n".join(line.text for line in lines)
            secondary_text = poppler_pages[page_index] if page_index < len(poppler_pages) else ""
            agreement = parser_agreement(primary_text, secondary_text)
            page_meta.append({
                "pdfPage": page_number,
                "printedPageLabel": printed_page_label(lines, float(page.height)),
                "parserAgreement": agreement,
                "pdfplumberTextSHA256": hashlib.sha256(primary_text.encode()).hexdigest(),
                "popplerTextSHA256": hashlib.sha256(secondary_text.encode()).hexdigest(),
            })
            if agreement < 0.72 and len(normalized_tokens(primary_text)) > 20:
                discrepancies.append({
                    "kind": "low-parser-agreement",
                    "sourcePDF": source.file_name,
                    "pdfPage": page_number,
                    "parserAgreement": agreement,
                    "reviewRequired": True,
                })

            page_words = poppler_bbox[page_index] if page_index < len(poppler_bbox) else []
            excluded_line_indexes: set[int] = set()
            table_candidates = page.find_tables() if re.search(r"\bTABLE\b|CONTINUED", primary_text, re.I) else []
            for table_offset, candidate in enumerate(table_candidates, start=1):
                bbox = tuple(float(value) for value in candidate.bbox)
                raw_rows = candidate.extract() or []
                rows = [[normalized_space(cell or "") for cell in row] for row in raw_rows]
                column_count = max((len(row) for row in rows), default=0)
                cell_text = " ".join(cell for row in rows for cell in row if cell)
                poppler_region = region_poppler_text(page_words, bbox)
                cell_coverage = parser_agreement(cell_text, poppler_region)
                blank_count = sum(1 for row in rows for cell in row if not cell)
                cell_count = sum(len(row) for row in rows)
                rectangular = (
                    len(rows) >= 2
                    and 2 <= column_count <= 20
                    and all(len(row) == column_count for row in rows)
                    and cell_count > 0
                    and blank_count / cell_count <= 0.4
                )
                caption = table_caption(lines, bbox)
                footnotes, footnote_line_indexes = table_footnotes(lines, bbox)
                caption_line_indexes: set[int] = set()
                if caption:
                    caption_indexes = [
                        line_index
                        for line_index, line in enumerate(lines)
                        if line.text == caption and 0 <= bbox[1] - line.bbox[3] <= 100
                    ]
                    if caption_indexes:
                        caption_index = caption_indexes[-1]
                        caption_top = lines[caption_index].bbox[1]
                        caption_line_indexes.update(
                            line_index
                            for line_index, line in enumerate(lines)
                            if caption_top - 2 <= line.bbox[1] <= bbox[1] + 2
                        )
                for line_index, line in enumerate(lines):
                    line_center = (line.bbox[1] + line.bbox[3]) / 2
                    inside_table = bbox[1] - 2 <= line_center <= bbox[3] + 2
                    is_caption = line_index in caption_line_indexes
                    is_footnote = line_index in footnote_line_indexes
                    if inside_table or is_caption or is_footnote:
                        excluded_line_indexes.add(line_index)
                verified = rectangular and cell_coverage >= 0.88 and agreement >= 0.72
                if verified:
                    table_id = f"{TABLE_ID_PREFIX}-{source.prefix.lower()}-{source.chapter_number.lower()}-p{page_number:04d}-{table_offset:02d}"
                    table = table_payload(
                        table_id,
                        rows,
                        caption,
                        footnotes,
                        source,
                        source_hash,
                        page_number,
                        bbox,
                    )
                    structured_tables.append(table)
                    pending_visuals.append((page_number, bbox[1], {
                        "id": f"{table_id}-block",
                        "kind": "table",
                        "tableID": table_id,
                        "caption": caption,
                        "html": structured_table_html(table),
                        "plainText": cell_text,
                        "reviewRequired": False,
                        "researchClaimEligible": True,
                    }))
                    continue
                asset_name = safe_asset_name(source.prefix, source.chapter_number, page_number, "table-review", table_offset)
                render_crop(page, bbox, assets_dir / asset_name)
                pending_visuals.append((page_number, bbox[1], {
                    "id": f"{asset_name}-block",
                    "kind": "image",
                    "imageID": asset_name,
                    "caption": caption or "Official PDF table — transcription requires review",
                    "plainText": "",
                    "reviewRequired": True,
                    "researchClaimEligible": False,
                    "officialPDFProvenance": {
                        "sourceURL": source.url,
                        "sourceSHA256": source_hash,
                        "pdfPage": page_number,
                        "bbox": [round(value, 2) for value in bbox],
                    },
                }))
                discrepancies.append({
                    "kind": "unverified-table",
                    "sourcePDF": source.file_name,
                    "sourceSHA256": source_hash,
                    "pdfPage": page_number,
                    "bbox": [round(value, 2) for value in bbox],
                    "caption": caption,
                    "parserAgreement": agreement,
                    "cellCoverage": cell_coverage,
                    "asset": asset_name,
                    "reviewRequired": True,
                    "researchClaimEligible": False,
                })

            for figure_offset, (
                caption,
                bbox,
                crop_method,
                embedded_image_bbox,
                source_embedded_image_bbox,
                caption_anchor,
                caption_line_indexes,
            ) in enumerate(
                likely_figure_regions(page, lines), start=1
            ):
                excluded_line_indexes.update(caption_line_indexes)
                asset_name = safe_asset_name(source.prefix, source.chapter_number, page_number, "figure", figure_offset)
                render_crop(
                    page,
                    bbox,
                    assets_dir / asset_name,
                    bottom_margin=(0 if crop_method.endswith("clipped-at-next-section") else None),
                )
                pending_visuals.append((page_number, caption_anchor, {
                    "id": f"{asset_name}-block",
                    "kind": "image",
                    "imageID": asset_name,
                    "caption": caption,
                    "plainText": "",
                    "reviewRequired": True,
                    "researchClaimEligible": False,
                    "officialPDFProvenance": {
                        "sourceURL": source.url,
                        "sourceSHA256": source_hash,
                        "pdfPage": page_number,
                        "bbox": [round(value, 2) for value in bbox],
                        "cropMethod": crop_method,
                        "embeddedImageBBox": embedded_image_bbox,
                        "sourceEmbeddedImageBBox": source_embedded_image_bbox,
                    },
                }))
                discrepancies.append({
                    "kind": "official-pdf-figure",
                    "sourcePDF": source.file_name,
                    "sourceSHA256": source_hash,
                    "pdfPage": page_number,
                    "bbox": [round(value, 2) for value in bbox],
                    "caption": caption,
                    "asset": asset_name,
                    "cropMethod": crop_method,
                    "embeddedImageBBox": embedded_image_bbox,
                    "sourceEmbeddedImageBBox": source_embedded_image_bbox,
                    "reviewRequired": True,
                    "researchClaimEligible": False,
                })
            page_lines.append([
                line for line_index, line in enumerate(lines)
                if line_index not in excluded_line_indexes
            ])

    sections = sections_from_lines(source, page_lines)
    if not sections and "reserved" not in source.title.lower():
        appendix_lines = [line for lines in page_lines for line in lines]
        if appendix_lines:
            sections = [SourceSection(
                prefix=source.prefix,
                chapter_number=source.chapter_number,
                section_number=source.chapter_number.upper(),
                title=source.title,
                heading_line=appendix_lines[0],
                lines=appendix_lines[1:],
            )]
    with pdfplumber.open(pdf_path) as pdf:
        for index, lines in enumerate(page_lines):
            add_page_provenance(
                sections,
                lines,
                index + 1,
                float(pdf.pages[index].height),
                page_meta[index]["parserAgreement"],
                source,
                source_hash,
            )
    for page_number, top, block in pending_visuals:
        if not attach_block_for_page(sections, page_number, top, block):
            discrepancies.append({
                "kind": "unbound-visual",
                "sourcePDF": source.file_name,
                "pdfPage": page_number,
                "asset": block.get("imageID"),
                "reviewRequired": True,
                "researchClaimEligible": False,
            })
    apply_curated_pdf_structure_overrides(
        source,
        source_hash,
        sections,
        structured_tables,
        discrepancies,
        assets_dir,
    )
    semantic_table_summary = apply_icc_semantic_tables(
        source,
        source_hash,
        sections,
        structured_tables,
        discrepancies,
        assets_dir,
        poppler_pages,
        semantic_snapshot,
    )
    recovered_semantic_section_count = apply_pdf_verified_semantic_section_recoveries(
        source,
        source_hash,
        sections,
        poppler_pages,
        semantic_snapshot,
    )
    if not sections:
        discrepancies.append({
            "kind": "no-section-headings-detected",
            "sourcePDF": source.file_name,
            "reviewRequired": True,
            "researchClaimEligible": False,
        })
    source_record = {
        "fileName": source.file_name,
        "title": source.title,
        "codePrefix": source.prefix,
        "chapterNumber": source.chapter_number,
        "sourceURL": source.url,
        "sourceSHA256": source_hash,
        "bytes": pdf_path.stat().st_size,
        "pageCount": len(page_lines),
        "sectionCount": len(sections),
        "minimumParserAgreement": min((page["parserAgreement"] for page in page_meta), default=0),
        "pageExtraction": page_meta,
        "semanticHTML": (
            {
                "publisher": "International Code Council",
                "sourceURL": semantic_snapshot["sourceURL"],
                "sourceSHA256": semantic_snapshot["sourceSHA256"],
                "role": "secondary semantic structure reference",
                "verifiedStructuredTableCount": semantic_table_summary["tableCount"],
                "officialPDFCorrectedCellCount": semantic_table_summary["correctedCellCount"],
                "officialPDFRecoveredSectionTextCount": recovered_semantic_section_count,
                "verifiedSectionHTMLCount": 0,
                "fallbackSectionHTMLCount": 0,
            }
            if semantic_snapshot is not None
            else None
        ),
    }
    return sections, structured_tables, discrepancies, source_record


EQUATION_LABEL = re.compile(r"^(?P<formula>.+?)\s*(?P<label>\(Equation\s+[^)]+\))$", re.I)
VARIABLE_DEFINITION = re.compile(
    r"^(?P<term>[A-Za-z](?:_[A-Za-z]{1,3})?)\s*=\s*(?P<definition>.+)$"
)


def equation_markup(value: str) -> str:
    escaped = html.escape(value)
    return re.sub(
        r"\b([A-Za-z])_([A-Za-z]{1,3})\b",
        r"\1<sub>\2</sub>",
        escaped,
    )


def paragraph_html(text: str) -> str:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
    rendered: list[str] = []
    for paragraph in paragraphs:
        lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
        if len(lines) == 1:
            equation = EQUATION_LABEL.match(lines[0])
            if equation:
                rendered.append(
                    '<div class="code-equation">'
                    f'<span class="code-equation-formula">{equation_markup(equation.group("formula"))}</span>'
                    f'<span class="code-equation-label">{html.escape(equation.group("label"))}</span>'
                    "</div>"
                )
                continue
        if lines and all(
            line.lower() == "where:" or VARIABLE_DEFINITION.match(line)
            for line in lines
        ):
            for line in lines:
                if line.lower() == "where:":
                    rendered.append('<p class="code-equation-where">where:</p>')
                    continue
                definition = VARIABLE_DEFINITION.match(line)
                if definition is None:
                    continue
                rendered.append(
                    '<div class="code-definition">'
                    f'<span class="code-definition-term">{equation_markup(definition.group("term"))}</span>'
                    '<span class="code-definition-equals">=</span>'
                    f'<span class="code-definition-text">{html.escape(definition.group("definition"))}</span>'
                    "</div>"
                )
            continue
        rendered.append(f"<p>{html.escape(paragraph).replace(chr(10), '<br>')}</p>")
    return "\n".join(rendered)


STRUCTURAL_LINE_START = re.compile(
    r"^(?:"
    r"\(?\d+[.)]\s+|"
    r"[a-z][.)]\s+|"
    # Legal Roman-numeral list markers in these codes are short (i through x).
    # A broad Roman-character class also misclassifies wrapped metric units
    # such as ``mm) minimum`` as authored list items.
    r"(?:i{1,3}|iv|v(?:i{0,3})?|ix|x)[.)]\s+|"
    r"[-•▪] ?\s*|"
    r"Exceptions?\s*:|"
    r"Notes?\s*:|"
    r"For SI\s*:|"
    r"where\s*:|"
    r"[A-Za-z](?:_[A-Za-z]{1,3}|[a-z]{1,3})?\s*=|"
    r"\*+"
    r")",
    re.I,
)


def line_separator(previous: Line, current: Line) -> str:
    """Distinguish PDF wrapping from authored structure.

    The DOB PDFs expose every typeset row as a separate extracted line. Most of
    those rows are soft wraps and must become spaces in Reader prose. Numbered
    items, exceptions, notes, headings, and visibly separated paragraphs retain
    a break. A section that crosses a PDF page is treated as continuous unless
    the next line carries one of those structural markers.
    """
    if STRUCTURAL_LINE_START.match(current.text):
        return "\n"
    if previous.page != current.page:
        return ""
    previous_height = max(previous.bbox[3] - previous.bbox[1], 1.0)
    current_height = max(current.bbox[3] - current.bbox[1], 1.0)
    vertical_gap = current.bbox[1] - previous.bbox[3]
    if vertical_gap > max(previous_height, current_height) * 0.8:
        return "\n\n"
    return ""


def source_text(section: SourceSection) -> str:
    if section.verified_semantic_text is not None:
        return section.verified_semantic_text
    if (
        section.prefix == "BC"
        and section.chapter_number == "7"
        and section.section_number == "705.7"
    ):
        return CURATED_BC_705_7_TEXT
    if not section.lines:
        return ""
    result = section.lines[0].text.strip()
    for previous, current in zip(section.lines, section.lines[1:]):
        value = current.text.strip()
        if not value:
            continue
        separator = line_separator(previous, current)
        if separator:
            result = result.rstrip() + separator + value
            continue
        if result.endswith("-") and value[0].islower():
            result += value
        else:
            result = result.rstrip() + " " + value
    return result.strip()


def strip_attached_table_caption_suffix(
    value: str,
    section: SourceSection,
    tables: list[dict],
) -> str:
    """Remove a PDF-extraction caption repeated at the end of section prose.

    The table itself remains a structured content block.  This only removes an
    exact normalized suffix for a table attached to the same section, so an
    ordinary in-sentence reference such as "Table 1018.1.1" is preserved.
    """
    table_ids = {
        str(block.get("tableID"))
        for block in section.blocks
        if block.get("kind") == "table" and block.get("tableID")
    }
    if not table_ids:
        return value

    result = value.strip()
    for table in tables:
        if str(table.get("id")) not in table_ids:
            continue
        caption = normalized_space(str(table.get("caption", "")))
        if not caption:
            continue
        suffixes = {caption}
        without_label = re.sub(r"^TABLE\s+", "", caption, flags=re.I)
        suffixes.add(normalized_space(without_label.replace("—", " ")))
        suffixes.add(normalized_space(without_label.replace("–", " ")))
        for suffix in sorted(suffixes, key=len, reverse=True):
            if not suffix:
                continue
            suffix_pattern = r"\s+".join(
                re.escape(part) for part in suffix.split()
            )
            match = re.search(rf"(?:^|\s){suffix_pattern}\s*$", result, re.I)
            if match:
                result = result[:match.start()].rstrip()
                break
    return result


def chapter_block_html(block: dict) -> str:
    """Render the same local content block into the native-reader source HTML."""
    block_html = str(block.get("html") or "").strip()
    if block_html:
        return block_html
    if block.get("kind") == "image" and block.get("imageID"):
        image_id = str(block["imageID"])
        if "/" in image_id or "\\" in image_id or image_id.startswith("."):
            raise RuntimeError(f"Unsafe bundled 2014 image identifier: {image_id}")
        caption = normalized_space(str(block.get("caption") or "Official code figure"))
        return (
            "<figure>"
            f'<img src="../assets/{html.escape(image_id, quote=True)}" '
            f'alt="{html.escape(caption, quote=True)}">'
            f"<figcaption>{html.escape(caption)}</figcaption>"
            "</figure>"
        )
    plain_text = str(block.get("plainText") or "").strip()
    return paragraph_html(plain_text) if plain_text else ""


def search_tokens(value: str) -> set[str]:
    return set(normalized_tokens(value))


def reconcile_update_packets(
    discovery: dict,
    source_dir: Path,
    pdftotext: str,
    section_map: dict[str, int],
) -> tuple[list[dict], list[dict]]:
    keys_by_number: dict[str, list[str]] = {}
    for key in section_map:
        _prefix, number = key.split(" ", 1)
        keys_by_number.setdefault(number.upper(), []).append(key)
    reconciled = []
    discrepancies = []
    citation_pattern = re.compile(
        r"(?<![\d.-])(?:28-\d{3,4}(?:\.\d+)+|[A-Z]?\d{3,4}(?:\.\d+)+)(?![\d.])",
        re.I,
    )
    for source in discovery.get("updates", []):
        record = dict(source)
        path = source_dir / "updates" / record["fileName"]
        try:
            text = "\n".join(poppler_layout_pages(path, pdftotext))
            references = sorted({match.upper() for match in citation_pattern.findall(text)})
            matches = sorted({key for reference in references for key in keys_by_number.get(reference, [])})
            unmatched = [reference for reference in references if reference not in keys_by_number]
            if references and not unmatched:
                status = "all-cited-sections-present-in-consolidated-archive"
                review_required = False
            elif matches:
                status = "partial-citation-match-review-required"
                review_required = True
            else:
                status = "no-cited-section-match-review-required"
                review_required = True
            record.update({
                "reconciliationStatus": status,
                "referencedSectionNumbers": references,
                "matchedCorpusSections": matches,
                "unmatchedSectionNumbers": unmatched,
                "reviewRequired": review_required,
            })
            if review_required:
                discrepancies.append({
                    "kind": "amendment-update-reconciliation",
                    "sourcePDF": record["fileName"],
                    "sourceSHA256": record["sourceSHA256"],
                    "sourceURL": record["sourceURL"],
                    "status": status,
                    "unmatchedSectionNumbers": unmatched,
                    "reviewRequired": True,
                    "researchClaimEligible": False,
                })
        except (OSError, subprocess.SubprocessError, ET.ParseError) as error:
            record.update({
                "reconciliationStatus": "extraction-failed-review-required",
                "reviewRequired": True,
                "error": type(error).__name__,
            })
            discrepancies.append({
                "kind": "amendment-update-reconciliation",
                "sourcePDF": record.get("fileName"),
                "sourceSHA256": record.get("sourceSHA256"),
                "sourceURL": record.get("sourceURL"),
                "status": "extraction-failed-review-required",
                "reviewRequired": True,
                "researchClaimEligible": False,
            })
        reconciled.append(record)
    return reconciled, discrepancies


def existing_stable_ids(output: Path) -> tuple[
    dict[tuple[str, str], int],
    dict[tuple[str, str, str], int],
    int,
    int,
]:
    """Load the current public IDs before rebuilding the generated package.

    Reader links and saved Research citations use these numeric IDs. A newly
    discovered official PDF must therefore receive new IDs without renumbering
    any previously published chapter or section.
    """
    manifest_path = output / "prepared" / "manifest.json"
    catalog_path = output / "prepared" / "chapterCatalog.json"
    if not output.exists() or not any(output.iterdir()):
        return {}, {}, CHAPTER_ID_BASE + 1, SECTION_ID_BASE
    if not manifest_path.is_file() or not catalog_path.is_file():
        raise RuntimeError(
            "Existing output has no stable-ID catalogs; refusing to replace published Reader IDs."
        )

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    catalog_document = json.loads(catalog_path.read_text(encoding="utf-8"))
    chapter_ids: dict[tuple[str, str], int] = {}
    section_ids: dict[tuple[str, str, str], int] = {}
    used_chapter_ids: set[int] = set()
    used_section_ids: set[int] = set()

    for chapter in manifest.get("chapters", []):
        identity = (
            str(chapter.get("codePrefix", "")).upper(),
            str(chapter.get("chapterNumber", "")),
        )
        chapter_id = int(chapter.get("chapterID"))
        if not all(identity) or identity in chapter_ids or chapter_id in used_chapter_ids:
            raise RuntimeError(f"Duplicate or invalid published chapter identity: {identity}")
        chapter_ids[identity] = chapter_id
        used_chapter_ids.add(chapter_id)

    for section in catalog_document.get("chapters", []):
        identity = (
            str(section.get("codePrefix", "")).upper(),
            str(section.get("chapterNumber", "")),
            str(section.get("sectionNumber", "")),
        )
        section_id = int(section.get("id"))
        if not all(identity) or identity in section_ids or section_id in used_section_ids:
            raise RuntimeError(f"Duplicate or invalid published section identity: {identity}")
        section_ids[identity] = section_id
        used_section_ids.add(section_id)

    if not chapter_ids or not section_ids:
        raise RuntimeError("Existing stable-ID catalogs are unexpectedly empty.")
    return (
        chapter_ids,
        section_ids,
        max(used_chapter_ids) + 1,
        max(used_section_ids) + 1,
    )


def build_package(
    sources: list[SourcePDF],
    source_dir: Path,
    output: Path,
    pdftotext: str,
    discovery: dict,
) -> dict:
    existing_chapter_ids, existing_section_ids, next_chapter_id, next_section_id = (
        existing_stable_ids(output)
    )
    if output.exists():
        shutil.rmtree(output)
    for relative in ["prepared/chapters", "prepared/sections", "chapters", "assets"]:
        (output / relative).mkdir(parents=True, exist_ok=True)

    bundle_chapters = []
    manifest_chapters = []
    catalog = []
    section_map: dict[str, int] = {}
    token_index: dict[str, set[int]] = {}
    all_tables = []
    all_discrepancies = []
    source_records = []
    reused_chapter_ids = 0
    reused_section_ids = 0

    for source in sources:
        pdf_path = source_dir / "chapters" / source.file_name
        if not pdf_path.is_file():
            raise FileNotFoundError(f"Missing official chapter PDF: {pdf_path}")
        semantic_snapshot = load_icc_semantic_snapshot(source_dir, source)
        chapter_identity = (source.prefix, source.chapter_number)
        chapter_id = existing_chapter_ids.get(chapter_identity)
        if chapter_id is None:
            chapter_id = next_chapter_id
            next_chapter_id += 1
        else:
            reused_chapter_ids += 1
        sections, tables, discrepancies, source_record = extract_source(
            source,
            pdf_path,
            pdftotext,
            output / "assets",
            semantic_snapshot,
        )
        all_tables.extend(tables)
        all_discrepancies.extend(discrepancies)
        source_records.append(source_record)
        section_summaries = []
        chapter_blocks = []
        section_html_fragments = []
        for section in sections:
            section_identity = (
                section.prefix,
                section.chapter_number,
                section.section_number,
            )
            section_id = existing_section_ids.get(section_identity)
            if section_id is None:
                section_id = next_section_id
                next_section_id += 1
            else:
                reused_section_ids += 1
            plain_text = strip_attached_table_caption_suffix(
                source_text(section),
                section,
                tables,
            )
            semantic_section = (
                semantic_snapshot.get("sectionHTML", {}).get(section.section_number)
                if semantic_snapshot is not None
                else None
            )
            semantic_html_verified = bool(
                semantic_section
                and semantic_verification_tokens(str(semantic_section.get("plainText", "")))
                == semantic_verification_tokens(plain_text)
            )
            text_block = {
                "id": f"nyc-2014-{section_id}-text",
                "kind": "html",
                "html": (
                    str(semantic_section["html"])
                    if semantic_html_verified
                    else paragraph_html(plain_text)
                ),
                "plainText": plain_text,
            }
            if semantic_snapshot is not None:
                semantic_summary = source_record.get("semanticHTML")
                if semantic_html_verified:
                    semantic_summary["verifiedSectionHTMLCount"] += 1
                    text_block.update({
                        "verificationStatus": (
                            section.semantic_text_recovery["verificationStatus"]
                            if section.semantic_text_recovery is not None
                            else "semantic-html-token-verified-against-official-pdf"
                        ),
                        "htmlStructureReference": {
                            "publisher": "International Code Council",
                            "url": semantic_section["anchorURL"],
                            "sourceSHA256": semantic_snapshot["sourceSHA256"],
                            "role": "secondary semantic structure reference",
                        },
                    })
                else:
                    semantic_summary["fallbackSectionHTMLCount"] += 1
                    if semantic_section is not None:
                        all_discrepancies.append({
                            "kind": "secondary-semantic-html-text-mismatch",
                            "sourcePDF": source.file_name,
                            "sourceSHA256": source_record["sourceSHA256"],
                            "semanticHTMLSourceURL": semantic_snapshot["sourceURL"],
                            "semanticHTMLSourceSHA256": semantic_snapshot["sourceSHA256"],
                            "sectionNumber": section.section_number,
                            "resolution": "official PDF-derived HTML retained",
                            "reviewRequired": True,
                            "researchClaimEligible": True,
                        })
            if (
                section.prefix == "BC"
                and section.chapter_number == "7"
                and section.section_number == "705.7"
            ):
                text_block.update({
                    "verificationStatus": "transcribed-and-verified-against-official-pdf",
                    "htmlStructureReference": {
                        "publisher": "International Code Council",
                        "url": f"{ICC_2014_BUILDING_CODE_CHAPTER_7_URL}#NYNYCBC2014P1_Ch07_Sec705.7",
                        "role": "secondary semantic structure reference",
                    },
                })
            blocks = [text_block, *section.blocks]
            detail = {
                "schemaVersion": 2,
                "sectionID": section_id,
                "chapterID": chapter_id,
                "chapterNumber": source.chapter_number,
                "codePrefix": source.prefix,
                "codeVersion": SYNC_VERSION,
                "sectionNumber": section.section_number,
                "title": section.title,
                "officialText": plain_text,
                "previewText": plain_text[:500],
                "blocks": blocks,
                "historicalConstructionCode": {
                    "schemaVersion": 1,
                    "libraryID": LIBRARY_ID,
                    "sourceAuthority": "New York City Department of Buildings",
                    "sourceURL": source.url,
                    "sourceSHA256": source_record["sourceSHA256"],
                    "sourcePages": section.source_pages,
                    "edition": "2014",
                    "applicabilityStatus": "prior-edition-case-specific",
                    "consolidationStatus": "DOB consolidated archive",
                    "researchClaimEligible": True,
                },
            }
            if section.semantic_text_recovery is not None:
                detail["historicalConstructionCode"]["semanticTextRecovery"] = (
                    section.semantic_text_recovery
                )
            write_json(output / "prepared" / "sections" / f"{section_id}.json", detail, compact=True)
            summary = {
                "id": section_id,
                "sectionNumber": section.section_number,
                "title": section.title,
                "officialText": "",
                "kind": "section",
                "contentBlocks": [],
            }
            section_summaries.append(summary)
            section_html_fragments.append("".join(
                chapter_block_html(block)
                for block in blocks
            ))
            catalog.append({
                "id": section_id,
                "chapterID": chapter_id,
                "codePrefix": source.prefix,
                "codeSectionID": CODE_SECTION_IDS[source.prefix],
                "codeVersion": SYNC_VERSION,
                "chapterNumber": source.chapter_number,
                "sectionNumber": section.section_number,
                "title": section.title,
                "headerLine": f"SECTION {source.prefix} {section.section_number.split('.')[0]}",
                "headingLine": source.title,
            })
            section_map[f"{source.prefix} {section.section_number}"] = section_id
            for token in search_tokens(f"{source.prefix} {section.section_number} {section.title} {plain_text}"):
                token_index.setdefault(token, set()).add(section_id)
            chapter_blocks.extend(blocks)

        group = {
            "id": f"nyc-2014-group-{chapter_id}",
            "headerLine": source.header_line,
            "headingLine": source.title,
            "sections": section_summaries,
        }
        write_json(output / "prepared" / "chapters" / f"{chapter_id}.json", {
            "schemaVersion": 1,
            "chapterID": chapter_id,
            "chapterNumber": source.chapter_number,
            "sourceURL": source.url,
            "groups": [group],
        }, compact=True)
        chapter_html = (
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            f"<title>{html.escape(source.title)}</title></head><body>"
            f"<h1>{html.escape(source.header_line)}</h1><h2>{html.escape(source.title)}</h2>"
            '<aside><strong>Historical edition.</strong> Applicability depends on the filing and project facts.</aside>'
            + "".join(
                f'<section id="nyc-2014-{summary["id"]}"><h3>{html.escape(source.prefix)} '
                f'{html.escape(summary["sectionNumber"])} {html.escape(summary["title"])}</h3>'
                f'{section_html_fragments[index]}</section>'
                for index, summary in enumerate(section_summaries)
            )
            + f'<p><a href="{html.escape(source.url)}">Official NYC DOB PDF</a></p></body></html>'
        )
        (output / "chapters" / f"{source.prefix.lower()}-{source.chapter_number}.html").write_text(
            chapter_html, encoding="utf-8"
        )
        bundle_chapters.append({
            "id": chapter_id,
            "codeID": 1,
            "codeSectionID": CODE_SECTION_IDS[source.prefix],
            "chapterNumber": source.chapter_number,
            "title": f"{source.prefix} {source.header_line} - {source.title}",
        })
        manifest_chapters.append({
            "chapterID": chapter_id,
            "chapterNumber": source.chapter_number,
            "codePrefix": source.prefix,
            "codeSectionID": CODE_SECTION_IDS[source.prefix],
            "sectionCount": len(section_summaries),
            "preparedSectionCount": len(section_summaries),
            "blockCount": len(chapter_blocks),
            "sourcePDF": source.file_name,
            "sourceSHA256": source_record["sourceSHA256"],
        })

    reconciled_updates, update_discrepancies = reconcile_update_packets(
        discovery,
        source_dir,
        pdftotext,
        section_map,
    )
    all_discrepancies.extend(update_discrepancies)

    bundle = {
        "schemaVersion": 5,
        "chapterStructureSchemaVersion": 2,
        "sectionContentSchemaVersion": 2,
        "jurisdictions": [{"id": 1, "name": "New York City"}],
        "codes": [{"id": 1, "jurisdictionID": 1, "name": CODE_VERSION}],
        "codeSections": [
            {"id": CODE_SECTION_IDS[prefix], "codeID": 1, "name": name}
            for prefix, name in CODE_NAMES.items()
        ],
        "chapters": bundle_chapters,
        "tables": all_tables,
        "nextJurisdictionID": 2,
        "nextCodeID": 2,
        "nextCodeSectionID": len(CODE_NAMES) + 1,
        "nextChapterID": next_chapter_id,
        "nextSectionID": next_section_id,
        "lastStructuredImportPaths": [],
        "historicalConstructionCodeContract": {
            "libraryID": LIBRARY_ID,
            "sourceAuthority": "New York City Department of Buildings",
            "sourcePageURL": CODE_PAGE_URL,
            "priorCodesURL": PRIOR_CODES_URL,
            "baselineAuthority": "Local Law 141 of 2013",
            "baselineSourceURL": LOCAL_LAW_141_URL,
            "amendmentIndexURL": AMENDMENT_INDEX_URL,
            "applicabilityStatus": "prior-edition-case-specific",
            "structuredTableCount": len(all_tables),
            "reviewRequiredRecordCount": sum(
                1 for item in all_discrepancies if item.get("reviewRequired")
            ),
        },
    }
    write_json(output / "bundle.json", bundle)
    write_json(output / "prepared" / "manifest.json", {
        "schemaVersion": 1,
        "libraryID": LIBRARY_ID,
        "codeVersion": CODE_VERSION,
        "syncCodeVersion": SYNC_VERSION,
        "sourceAuthority": "New York City Department of Buildings",
        "sourcePageURL": CODE_PAGE_URL,
        "applicabilityStatus": "prior-edition-case-specific",
        "chapters": manifest_chapters,
    })
    write_json(output / "prepared" / "chapterCatalog.json", {"chapters": catalog})
    write_json(output / "prepared" / "section-map.json", section_map)
    write_json(output / "prepared" / "searchIndex.json", {
        "schemaVersion": 1,
        "tokens": {token: sorted(ids) for token, ids in sorted(token_index.items())},
    })
    asset_files = sorted(path for path in (output / "assets").iterdir() if path.is_file())
    image_manifest_items: dict[str, str] = {}
    for asset_path in asset_files:
        relative_path = f"assets/{asset_path.name}"
        image_manifest_items[asset_path.name] = relative_path
        image_manifest_items[asset_path.stem] = relative_path
    write_json(output / "prepared" / "images.json", {
        "schemaVersion": 1,
        "storage": "bundled-local-assets",
        "items": image_manifest_items,
    })
    write_json(output / "source-manifest.json", {
        "schemaVersion": 1,
        "libraryID": LIBRARY_ID,
        "generatedAt": date.today().isoformat(),
        "sourceAuthority": "New York City Department of Buildings and New York City Council",
        "sourcePageURL": CODE_PAGE_URL,
        "sourcePageSHA256": discovery.get("codePageSHA256"),
        "updatePageURL": UPDATE_PAGE_URL,
        "updatePageSHA256": discovery.get("updatePageSHA256"),
        "priorCodesURL": PRIOR_CODES_URL,
        "baselineLocalLaw": "Local Law 141 of 2013",
        "baselineSourceURL": LOCAL_LAW_141_URL,
        "baselineSourceSHA256": discovery.get("localLaw141SHA256"),
        "amendmentIndexURL": AMENDMENT_INDEX_URL,
        "amendmentIndexSHA256": discovery.get("amendmentIndexSHA256"),
        "chapterPDFs": source_records,
        "secondaryHTMLReferences": [
            record["semanticHTML"]
            for record in source_records
            if record.get("semanticHTML")
        ],
        "prohibitedSources": [
            "No UpCodes text, diagram, image, HTML, or other asset is included in this corpus."
        ],
        "validationSummary": {
            "independentTextExtractors": ["pdfplumber", "Poppler pdftotext"],
            "chapterPDFCount": len(source_records),
            "structuredTableCount": len(all_tables),
            "discrepancyCount": len(all_discrepancies),
        },
    })
    write_json(output / "amendment-ledger.json", {
        "schemaVersion": 1,
        "status": "reference-and-reconciliation",
        "rule": "DOB consolidated chapter PDFs control. Amendment records are checked against that text and are not replayed as blind replacements.",
        "amendmentIndexURL": AMENDMENT_INDEX_URL,
        "amendmentIndexSHA256": discovery.get("amendmentIndexSHA256"),
        "updatePageURL": UPDATE_PAGE_URL,
        "updatePackets": reconciled_updates,
        "baselineLocalLaw": {
            "name": "Local Law 141 of 2013",
            "sourceURL": LOCAL_LAW_141_URL,
            "sourceSHA256": discovery.get("localLaw141SHA256"),
        },
    })
    write_json(output / "discrepancy-manifest.json", {
        "schemaVersion": 1,
        "failClosed": True,
        "records": all_discrepancies,
    })
    (output / "SOURCE.md").write_text(
        "# 2014 NYC Construction Codes source contract\n\n"
        "This historical corpus is generated only from official NYC Department of Buildings "
        "and New York City Council sources. The DOB chapter PDFs are the controlling consolidated "
        "archive. Local Law 141 of 2013, the DOB amendment index, and the official update packets "
        "are provenance and reconciliation sources.\n\n"
        "Structured tables must reconcile between pdfplumber's grid extraction and Poppler's "
        "independent word map. Unresolved tables and figures are rendered from the official PDF, "
        "marked review-required, and excluded from numerical Research claims until reviewed.\n\n"
        "Where an ICC Digital Codes semantic HTML snapshot is available, Permitext may use its "
        "publisher-neutral paragraph, list, and table structure only after its enacted text or "
        "every table cell reconciles with the controlling DOB PDF. The ICC page is never loaded "
        "by the app. Any mismatch falls back to the official PDF extraction, and the official PDF "
        "controls corrections.\n\n"
        "No UpCodes text, diagram, image, HTML, or other asset is part of this package.\n",
        encoding="utf-8",
    )
    return {
        "chapters": len(bundle_chapters),
        "sections": len(catalog),
        "tables": len(all_tables),
        "discrepancies": len(all_discrepancies),
        "reusedChapterIDs": reused_chapter_ids,
        "reusedSectionIDs": reused_section_ids,
    }


def fetch_sources(source_dir: Path, sources: list[SourcePDF]) -> dict:
    source_dir.mkdir(parents=True, exist_ok=True)
    for index, source in enumerate(sources, start=1):
        print(f"[{index}/{len(sources)}] {source.file_name}", file=sys.stderr)
        download(source.url, source_dir / "chapters" / source.file_name)

    update_sources, update_page_hash = discover_update_sources()
    update_records = []
    for index, (url, title) in enumerate(update_sources, start=1):
        file_name = Path(urllib.parse.urlparse(url).path).name
        destination = source_dir / "updates" / file_name
        print(f"[update {index}/{len(update_sources)}] {file_name}", file=sys.stderr)
        download(url, destination)
        update_records.append({
            "title": title,
            "fileName": file_name,
            "sourceURL": url,
            "sourceSHA256": sha256(destination),
            "bytes": destination.stat().st_size,
        })

    amendment_path = source_dir / "amendments" / "AmendmentIndexCombined_2014.pdf"
    local_law_path = source_dir / "baseline" / "ll141of2013.pdf"
    download(AMENDMENT_INDEX_URL, amendment_path)
    download(LOCAL_LAW_141_URL, local_law_path)
    return {
        "updatePageSHA256": update_page_hash,
        "updates": update_records,
        "amendmentIndexSHA256": sha256(amendment_path),
        "localLaw141SHA256": sha256(local_law_path),
    }


def validate_package(output: Path) -> dict:
    bundle = json.loads((output / "bundle.json").read_text(encoding="utf-8"))
    manifest = json.loads((output / "prepared" / "manifest.json").read_text(encoding="utf-8"))
    discrepancies = json.loads((output / "discrepancy-manifest.json").read_text(encoding="utf-8"))
    image_manifest = json.loads((output / "prepared" / "images.json").read_text(encoding="utf-8"))
    section_files = list((output / "prepared" / "sections").glob("*.json"))
    chapter_files = list((output / "prepared" / "chapters").glob("*.json"))
    if len(bundle.get("chapters", [])) != len(chapter_files):
        raise RuntimeError("Bundle/chapter file count mismatch.")
    if len(manifest.get("chapters", [])) != len(chapter_files):
        raise RuntimeError("Manifest/chapter file count mismatch.")
    if not section_files:
        raise RuntimeError("The generated corpus has no sections.")
    tables_by_id = {
        str(table.get("id")): table
        for table in bundle.get("tables", [])
        if table.get("id")
    }
    referenced_table_ids: set[str] = set()
    referenced_image_ids: set[str] = set()
    retained_structural_breaks = 0
    for path in section_files:
        section = json.loads(path.read_text(encoding="utf-8"))
        provenance = section.get("historicalConstructionCode", {})
        if not provenance.get("sourceSHA256") or not provenance.get("sourcePages"):
            raise RuntimeError(f"Missing page provenance: {path}")
        official_text = str(section.get("officialText", ""))
        code_prefix = re.escape(str(section.get("codePrefix", "")))
        if re.search(rf"(?:^|\n)\*?SECTION\s+{code_prefix}\s+[A-Z0-9.-]+", official_text):
            raise RuntimeError(f"Presentation-only section banner leaked into {path}")
        text_lines = official_text.split("\n")
        for line_index, line in enumerate(text_lines[1:], start=1):
            if not line or not text_lines[line_index - 1]:
                continue
            if not STRUCTURAL_LINE_START.match(line):
                raise RuntimeError(f"Unexpected physical PDF hard break in {path}: {line[:80]}")
            retained_structural_breaks += 1
        for block in section.get("blocks", []):
            if block.get("kind") == "image":
                image_id = str(block.get("imageID", ""))
                if not image_id or "://" in image_id:
                    raise RuntimeError(f"Image block is not a bundled local asset in {path}: {image_id}")
                relative_path = image_manifest.get("items", {}).get(image_id)
                if not relative_path or "://" in relative_path:
                    raise RuntimeError(f"Image block is absent from the local image manifest in {path}: {image_id}")
                asset_path = output / relative_path
                if not asset_path.is_file() or asset_path.stat().st_size == 0:
                    raise RuntimeError(f"Bundled image asset is missing or empty: {asset_path}")
                referenced_image_ids.add(image_id)
            if block.get("kind") != "table":
                continue
            table_id = str(block.get("tableID", ""))
            if not table_id or table_id not in tables_by_id:
                raise RuntimeError(f"Unresolved table block in {path}: {table_id or '(missing ID)'}")
            if "<table" not in str(block.get("html", "")).lower():
                raise RuntimeError(f"Table block lacks renderable HTML in {path}: {table_id}")
            referenced_table_ids.add(table_id)
    for table in bundle.get("tables", []):
        if not table.get("officialPDFProvenance", {}).get("sourceSHA256"):
            raise RuntimeError(f"Table lacks official PDF provenance: {table.get('id')}")
        row_count = int(table.get("rowCount", 0))
        column_count = int(table.get("columnCount", 0))
        if row_count <= 0 or column_count <= 0:
            raise RuntimeError(f"Table has invalid dimensions: {table.get('id')}")
        occupied: set[tuple[int, int]] = set()
        for cell in table.get("cells", []):
            row = int(cell.get("row", -1))
            column = int(cell.get("column", -1))
            row_span = int(cell.get("rowSpan", 0))
            column_span = int(cell.get("columnSpan", 0))
            if (
                row < 0 or column < 0 or row_span <= 0 or column_span <= 0
                or row + row_span > row_count
                or column + column_span > column_count
            ):
                raise RuntimeError(f"Table cell is outside its grid: {table.get('id')} {cell}")
            for occupied_row in range(row, row + row_span):
                for occupied_column in range(column, column + column_span):
                    coordinate = (occupied_row, occupied_column)
                    if coordinate in occupied:
                        raise RuntimeError(
                            f"Table cells overlap at {coordinate}: {table.get('id')}"
                        )
                    occupied.add(coordinate)
    has_bc10 = any(
        chapter.get("codePrefix") == "BC" and str(chapter.get("chapterNumber")) == "10"
        for chapter in manifest.get("chapters", [])
    )
    if has_bc10:
        bc10_tables = {
            str(table.get("id")): table
            for table in bundle.get("tables", [])
            if str(table.get("id", "")).startswith(f"{TABLE_ID_PREFIX}-bc-10-")
        }
        expected_bc10_ids = {
            f"{TABLE_ID_PREFIX}-bc-10-{reference.replace('.', '-')}"
            for reference in ICC_BC10_TABLE_PDF_PAGES
        }
        if set(bc10_tables) != expected_bc10_ids:
            raise RuntimeError(
                "Chapter 10 native table set mismatch: "
                f"missing={sorted(expected_bc10_ids - set(bc10_tables))}, "
                f"unexpected={sorted(set(bc10_tables) - expected_bc10_ids)}"
            )
        table_1004 = bc10_tables[f"{TABLE_ID_PREFIX}-bc-10-1004-1-1"]
        if int(table_1004.get("rowCount", 0)) != 57:
            raise RuntimeError("Table 1004.1.1 must be one complete 57-row native table.")
        table_1028 = bc10_tables[f"{TABLE_ID_PREFIX}-bc-10-1028-10-1"]
        table_1028_values = [
            str(cell.get("plainText", "")) for cell in table_1028.get("cells", [])
        ]
        if "17" not in table_1028_values or table_1028_values.count("7") != 0:
            raise RuntimeError("Table 1028.10.1 did not retain the official-PDF value 17 correction.")
    unbound_table_ids = sorted(set(tables_by_id) - referenced_table_ids)
    if unbound_table_ids:
        raise RuntimeError(f"Structured tables are not bound to Reader sections: {unbound_table_ids[:5]}")
    if discrepancies.get("failClosed") is not True:
        raise RuntimeError("Discrepancy manifest is not fail-closed.")
    figure_records = [
        record for record in discrepancies.get("records", [])
        if record.get("kind") == "official-pdf-figure"
    ]
    for record in figure_records:
        asset = output / "assets" / str(record.get("asset", ""))
        if not asset.is_file() or asset.stat().st_size == 0:
            raise RuntimeError(f"Missing figure crop: {asset}")
        embedded_bbox = record.get("embeddedImageBBox")
        crop_bbox = record.get("bbox")
        if embedded_bbox:
            if (
                crop_bbox[0] > embedded_bbox[0]
                or crop_bbox[1] > embedded_bbox[1]
                or crop_bbox[2] < embedded_bbox[2]
                or crop_bbox[3] < embedded_bbox[3]
            ):
                raise RuntimeError(f"Figure crop excludes part of its embedded PDF image: {asset}")
    return {
        "chapters": len(chapter_files),
        "sections": len(section_files),
        "tables": len(bundle.get("tables", [])),
        "discrepancies": len(discrepancies.get("records", [])),
        "renderableTableBindings": len(referenced_table_ids),
        "figures": len(figure_records),
        "bundledImageBindings": len(referenced_image_ids),
        "embeddedImageFigureCrops": sum(
            1 for record in figure_records
            if str(record.get("cropMethod", "")).startswith("embedded-pdf-image-bbox")
        ),
        "retainedStructuralBreaks": retained_structural_breaks,
    }


def main() -> None:
    options = arguments()
    pdftotext = resolved_pdftotext(options.pdftotext)
    if options.check:
        if not options.output:
            raise SystemExit("--check requires --output")
        print(json.dumps(validate_package(options.output), indent=2))
        return
    sources, code_page_hash = discover_code_sources()
    if options.limit_files > 0:
        sources = sources[: options.limit_files]
    discovery = {"codePageSHA256": code_page_hash}
    if options.fetch:
        discovery.update(fetch_sources(options.source_dir, sources))
    else:
        provenance_path = options.source_dir / "fetch-manifest.json"
        if provenance_path.is_file():
            discovery.update(json.loads(provenance_path.read_text(encoding="utf-8")))
    write_json(options.source_dir / "fetch-manifest.json", discovery)
    if options.output:
        result = build_package(sources, options.source_dir, options.output, pdftotext, discovery)
        result["validation"] = validate_package(options.output)
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"sources": len(sources), **discovery}, indent=2))


if __name__ == "__main__":
    main()
