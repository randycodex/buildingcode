#!/usr/bin/env python3
"""Repair prepared chapter group headerLine values from rawDraftText."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "NYC CC APP/NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes"
CHAPTERS_DIR = BUNDLE / "prepared/chapters"

KNOWN_PREFIXES = ("BC", "FGC", "MC", "PC")

RE_HASH_GROUP = re.compile(r"^#--\s+(.+?)\s*$", re.M)
RE_PLAIN_SECTION = re.compile(r"^Section\s+.+$", re.M | re.I)
RE_GROUP_LINE = re.compile(
    r"(?i)^section\s+(?:(BC|FGC|MC|PC)\s+)?([A-Z0-9.\-()]+)(?:\s*[:\-–—]\s*(.*))?$"
)


def default_prefix(code_section_name: str) -> str:
    name = (code_section_name or "").upper()
    if "FUEL GAS" in name:
        return "FGC"
    if "MECHANICAL" in name:
        return "MC"
    if "PLUMBING" in name:
        return "PC"
    return "BC"


def formatted_header(explicit_prefix, section_id: str, code_section_name: str) -> str:
    section_id = section_id.strip().upper()
    prefix = explicit_prefix.upper().strip() if explicit_prefix else None

    if not prefix:
        for candidate in KNOWN_PREFIXES:
            if section_id.startswith(f"{candidate} "):
                prefix = candidate
                section_id = section_id[len(candidate) + 1 :].strip()
                break

    if prefix:
        return f"SECTION {prefix} {section_id}"

    if "." in section_id:
        return f"SECTION {section_id}"

    return f"SECTION {default_prefix(code_section_name)} {section_id}"


def parse_authored_group_line(line: str, code_section_name: str):
    line = line.strip()
    m = RE_GROUP_LINE.match(line)
    if not m:
        return "", None
    explicit, section_id, subtitle = m.group(1), m.group(2), m.group(3)
    header = formatted_header(explicit, section_id, code_section_name)
    heading = subtitle.strip().upper() if subtitle and subtitle.strip() else None
    return header, heading


def authored_group_lines(raw: str, code_section_name: str) -> list[str]:
    lines = []
    for m in RE_HASH_GROUP.finditer(raw):
        lines.append(m.group(1))
    if lines:
        return lines
    for m in RE_PLAIN_SECTION.finditer(raw):
        text = m.group(0).strip()
        header, _ = parse_authored_group_line(text, code_section_name)
        if header and not header.endswith(".") and " " in header.replace("SECTION ", "", 1):
            lines.append(text)
    return lines


def main() -> None:
    bundle = json.loads((BUNDLE / "bundle.json").read_text())
    cs_names = {cs["id"]: cs["name"] for cs in bundle["codeSections"]}
    ch_meta = {c["id"]: c for c in bundle["chapters"]}

    updated_files = 0
    updated_groups = 0

    for path in sorted(CHAPTERS_DIR.glob("*.json"), key=lambda p: int(p.stem)):
        data = json.loads(path.read_text())
        meta = ch_meta.get(data.get("chapterID"), {})
        cs_name = cs_names.get(meta.get("codeSectionID", 0), "")
        raw = data.get("rawDraftText") or ""
        authored = authored_group_lines(raw, cs_name)
        groups = data.get("groups") or []
        file_changed = False

        for index, group in enumerate(groups):
            if index >= len(authored):
                break
            header, heading = parse_authored_group_line(authored[index], cs_name)
            if not header:
                continue
            old_header = group.get("headerLine", "")
            if old_header != header:
                group["headerLine"] = header
                group["id"] = header
                updated_groups += 1
                file_changed = True
            if heading and group.get("headingLine") and group["headingLine"].upper() != heading:
                group["headingLine"] = heading
                file_changed = True

        if file_changed:
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            updated_files += 1

    print(f"Updated {updated_groups} group headers across {updated_files} chapter files.")


if __name__ == "__main__":
    main()
