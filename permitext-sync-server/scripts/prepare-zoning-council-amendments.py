#!/usr/bin/env python3
"""Extract enacted wording (excluding struck/deleted runs) and original map bytes.

The Council's adopted attachments are DOCX files even though View.ashx does not
advertise that in its URL. Keep those originals with the generated supplement.
"""
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'permitext-sync-server/config/zoning-adopted-amendments/2026-11-12'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + NS['w'] + '}'


def paragraphs(archive):
    root = ET.fromstring(archive.read('word/document.xml'))
    result = []
    for paragraph in root.findall('.//w:p', NS):
        values = []
        for run in paragraph.findall('w:r', NS):
            strike = run.find('w:rPr/w:strike', NS)
            if strike is not None and strike.get(W + 'val') not in ('0', 'false', 'off'):
                continue
            for node in run:
                if node.tag == W + 't':
                    values.append(node.text or '')
                elif node.tag in (W + 'tab', W + 'br', W + 'cr'):
                    values.append(' ')
        text = re.sub(r'\s+', ' ', ''.join(values)).strip()
        if text:
            result.append(text)
    return result


def section(lines, number):
    start = lines.index(number)
    end = next(i for i in range(start + 2, len(lines)) if re.fullmatch(r'(\*\s*){3}', lines[i]))
    return {'sectionNumber': number, 'title': lines[start + 1], 'paragraphs': lines[start + 2:end]}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    amendments = []
    for resolution, application, title, guid, attachment, sections in [
        (737, 'N 260211 ZRM', 'Studio 54 Rehabilitation', '495FE572-62F4-4B3D-9CAC-B0098DC11A5C', 16134334, ['81-744', '81-745']),
        (736, 'N 260362 ZRR', 'South Richmond Designated Open Space', '8C6012BC-39A3-43E5-A578-1C3E4F597148', 16132623, ['107-64']),
    ]:
        original = ROOT / f'docs/source-evidence/zoning/2026-11-12-res-{resolution}.docx'
        data = original.read_bytes()
        source = f'https://legistar.council.nyc.gov/View.ashx?GUID={guid}&ID={attachment}&M=F'
        with zipfile.ZipFile(original) as archive:
            lines = paragraphs(archive)
            entry = dict(resolution=resolution, application=application, title=title,
                         adoptedDate='2026-11-12', effectiveDate='2026-11-12',
                         sourceURL=source, sourceFile=str(original.relative_to(ROOT)),
                         sourceSHA256=hashlib.sha256(data).hexdigest(),
                         sections=[section(lines, number) for number in sections])
            if resolution == 736:
                entry['maps'] = []
                for number, names in [('3', ['image2.png']), ('3.2', ['image4.png']),
                                      ('3.3', ['image6.png', 'image7.jpeg']), ('3.5', ['image9.png'])]:
                    images = []
                    for name in names:
                        data = archive.read('word/media/' + name)
                        file = 'res-736-' + name
                        (OUTPUT / file).write_bytes(data)
                        images.append(dict(file=file, sourceURL=source + '#word/media/' + name,
                                           sha256=hashlib.sha256(data).hexdigest(),
                                           contentType='image/png' if name.endswith('.png') else 'image/jpeg'))
                    entry['maps'].append(dict(number=number, images=images))
            amendments.append(entry)
    (OUTPUT / 'amendments.json').write_text(json.dumps(dict(schemaVersion=1,
        consolidatedTextChangesThrough='2026-10-22', textChangesThrough='2026-11-12',
        amendments=amendments), ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
