#!/usr/bin/env python3
"""Build an isolated pack-to-app source catalog; does not enable downloads."""
import argparse
import json
from pathlib import Path


def catalog(resource_root):
    authored = resource_root / 'CodeContent' / 'authored'
    packs, seen = [], set()
    for path in sorted(authored.glob('*/*/bundle.json')):
        metadata = json.loads(path.read_text())
        codes = {row['id']: row for row in metadata['codes']}
        jurisdictions = {row['id'] for row in metadata['jurisdictions']}
        if len(codes) != len(metadata['codes']):
            raise ValueError(f'Duplicate code identity: {path}')
        sources = []
        for category in metadata['codeSections']:
            code = codes[category['codeID']]
            jurisdiction = code['jurisdictionID']
            if jurisdiction not in jurisdictions:
                raise ValueError(f'Unknown jurisdiction: {path}')
            identity = dict(canonicalEdition=f'{path.relative_to(resource_root).as_posix()}#{code["id"]}',
                            jurisdictionID=jurisdiction, codeID=code['id'], categoryID=category['id'])
            key = json.dumps(identity, sort_keys=True)
            if key in seen:
                raise ValueError(f'Duplicate source identity: {identity}')
            seen.add(key)
            sources.append(identity)
        packs.append(dict(packID=path.parent.name,
                          bundlePath=path.relative_to(resource_root).as_posix(),
                          sources=sources))
    if not packs:
        raise ValueError('No authored packs found')
    return dict(schemaVersion=1, purpose='isolated catalog prototype; no download activation', packs=packs)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('resource_root', type=Path)
    args = parser.parse_args()
    print(json.dumps(catalog(args.resource_root), indent=2))
