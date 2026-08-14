#!/usr/bin/env python3
"""Extract the three official FC 503 figures from the FDNY 2022 Chapter 5 PDF.

Source: https://www.nyc.gov/assets/fdny/downloads/pdf/about/chapter-5-2022.pdf
Re-run is idempotent: it overwrites the same three PNG filenames.
"""

from __future__ import annotations

import argparse
import hashlib
import urllib.request
from pathlib import Path

import fitz

OFFICIAL_PDF_URL = "https://www.nyc.gov/assets/fdny/downloads/pdf/about/chapter-5-2022.pdf"
EXPECTED_PDF_SHA256 = "e25594ba5fde65eed247292c783d1a30ccdf279b81c72adf64f98ff0e1417d05"

FIGURES = (
    {
        "page": 7,
        "clip": (70, 232, 542, 445),
        "name": "fire-code-figure-503-2-7-2-1-no-parking-fire-apparatus-access-road.png",
        "sha256": "64fba97a516edd6db3141e59b315a49902a9e01d39e5f573c96127583f2c53d6",
    },
    {
        "page": 9,
        "clip": (28, 28, 584, 618),
        "name": "fire-code-figure-503-2-9-dead-end-fire-apparatus-access-road-turnaround.png",
        "sha256": "c2880daee1b386248b0af2fd5da21990010e37b7919dc4b3c487fab002cf363f",
    },
    {
        "page": 11,
        "clip": (70, 36, 542, 250),
        "name": "fire-code-figure-503-4-1-fire-lane-sign.png",
        "sha256": "42aef39f1f392e7725c7687413ddc73abc976d4fb868e4b73a766958073ff62d",
    },
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, help="Local Chapter 5 PDF. Downloads the official FDNY file if omitted.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[2]
        / "NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code/assets",
    )
    parser.add_argument("--check", action="store_true", help="Verify existing files without rewriting.")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    if args.check:
        for figure in FIGURES:
            path = args.output / figure["name"]
            if not path.exists():
                raise SystemExit(f"missing {path}")
            digest = sha256(path)
            if digest != figure["sha256"]:
                raise SystemExit(f"hash drift {figure['name']}: {digest}")
        print("fc 503 figures ok", {"count": len(FIGURES)})
        return

    if args.pdf:
        pdf_bytes = args.pdf.read_bytes()
    else:
        with urllib.request.urlopen(OFFICIAL_PDF_URL) as response:
            pdf_bytes = response.read()
    pdf_digest = hashlib.sha256(pdf_bytes).hexdigest()
    if pdf_digest != EXPECTED_PDF_SHA256:
        raise SystemExit(f"official PDF hash changed: {pdf_digest}")

    tmp_pdf = args.output / ".chapter-5-2022.pdf"
    tmp_pdf.write_bytes(pdf_bytes)
    try:
        document = fitz.open(tmp_pdf)
        scale = 200 / 72
        for figure in FIGURES:
            page = document[figure["page"] - 1]
            clip = fitz.Rect(*figure["clip"])
            pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=clip, alpha=False)
            dest = args.output / figure["name"]
            pixmap.save(str(dest))
            digest = sha256(dest)
            if digest != figure["sha256"]:
                raise SystemExit(f"extracted hash drift {figure['name']}: {digest}")
    finally:
        tmp_pdf.unlink(missing_ok=True)

    print("extracted fc 503 figures", {"count": len(FIGURES), "sourceHash": pdf_digest})


if __name__ == "__main__":
    main()
