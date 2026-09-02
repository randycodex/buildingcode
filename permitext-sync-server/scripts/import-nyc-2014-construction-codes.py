#!/usr/bin/env python3
"""Build Permitext's historical 2014 NYC Construction Codes corpus.

Only official NYC Department of Buildings and New York City Council sources are
accepted.  The DOB chapter PDFs are treated as the consolidated archive.  The
official amendment index, update packets, and Local Law 141 of 2013 are retained
as provenance and reconciliation sources; they are never replayed blindly over
the consolidated PDFs.

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
    chapter_match = re.search(r"Chapter_?(\d+)", file_name, re.I)
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
        if rows and abs(float(rows[-1][0]["top"]) - float(word["top"])) <= 2.75:
            rows[-1].append(word)
        else:
            rows.append([word])
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


def table_footnotes(lines: list[Line], bbox: tuple[float, float, float, float]) -> list[str]:
    below = [line.text for line in lines if 0 <= line.bbox[1] - bbox[3] <= 135]
    return [
        value for value in below
        if re.match(r"^(?:For SI:|[a-z*]{1,3}[.):]\s|Note:)", value, re.I)
    ][:12]


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
        tag = "th" if row_index == 0 else "td"
        row_cells = []
        for cell in sorted(cells_by_row.get(row_index, []), key=lambda value: int(value.get("column", 0))):
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
    caption_html = f"<caption>{html.escape(caption)}</caption>" if caption else ""
    footnotes = "".join(
        f"<p class=\"code-table-footnote\">{html.escape(value)}</p>"
        for value in table.get("footnotes", [])
        if value
    )
    return (
        f'<table data-table-id="{html.escape(str(table.get("id", "")))}">'
        f"{caption_html}<tbody>{''.join(body_rows)}</tbody></table>{footnotes}"
    )


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


def extract_source(
    source: SourcePDF,
    pdf_path: Path,
    pdftotext: str,
    assets_dir: Path,
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
                footnotes = table_footnotes(lines, bbox)
                for line_index, line in enumerate(lines):
                    line_center = (line.bbox[1] + line.bbox[3]) / 2
                    inside_table = bbox[1] - 2 <= line_center <= bbox[3] + 2
                    is_caption = bool(
                        caption
                        and line.text == caption
                        and 0 <= bbox[1] - line.bbox[3] <= 100
                    )
                    is_footnote = line.text in footnotes and 0 <= line.bbox[1] - bbox[3] <= 135
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
    }
    return sections, structured_tables, discrepancies, source_record


def paragraph_html(text: str) -> str:
    paragraphs = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
    return "\n".join(
        f"<p>{html.escape(part).replace(chr(10), '<br>')}</p>" for part in paragraphs
    )


STRUCTURAL_LINE_START = re.compile(
    r"^(?:"
    r"\(?\d+[.)]\s+|"
    r"[a-z][.)]\s+|"
    r"[ivxlcdm]+[.)]\s+|"
    r"[-•▪] ?\s*|"
    r"Exceptions?\s*:|"
    r"Notes?\s*:|"
    r"For SI\s*:|"
    r"\*+|"
    r"(?:SECTION|CHAPTER)\s+[A-Z0-9]"
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


def build_package(
    sources: list[SourcePDF],
    source_dir: Path,
    output: Path,
    pdftotext: str,
    discovery: dict,
) -> dict:
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
    next_section_id = SECTION_ID_BASE

    for chapter_offset, source in enumerate(sources, start=1):
        pdf_path = source_dir / "chapters" / source.file_name
        if not pdf_path.is_file():
            raise FileNotFoundError(f"Missing official chapter PDF: {pdf_path}")
        chapter_id = CHAPTER_ID_BASE + chapter_offset
        sections, tables, discrepancies, source_record = extract_source(
            source,
            pdf_path,
            pdftotext,
            output / "assets",
        )
        all_tables.extend(tables)
        all_discrepancies.extend(discrepancies)
        source_records.append(source_record)
        section_summaries = []
        chapter_blocks = []
        section_html_fragments = []
        for section in sections:
            section_id = next_section_id
            next_section_id += 1
            plain_text = source_text(section)
            text_block = {
                "id": f"nyc-2014-{section_id}-text",
                "kind": "html",
                "html": paragraph_html(plain_text),
                "plainText": plain_text,
            }
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
            section_html_fragments.append(text_block["html"])
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
        "nextChapterID": CHAPTER_ID_BASE + len(bundle_chapters) + 1,
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
        "No UpCodes text, diagram, image, HTML, or other asset is part of this package.\n",
        encoding="utf-8",
    )
    return {
        "chapters": len(bundle_chapters),
        "sections": next_section_id - SECTION_ID_BASE,
        "tables": len(all_tables),
        "discrepancies": len(all_discrepancies),
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
