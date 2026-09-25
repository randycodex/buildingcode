#!/usr/bin/env python3
"""Build an isolated pack-to-app source catalog; does not enable downloads."""
import argparse
import json
import re
from pathlib import Path


def canonical_sources(metadata, bundle_path):
    parts = bundle_path.split('/')
    if (len(parts) != 5 or parts[:2] != ['CodeContent', 'authored']
            or parts[-1] != 'bundle.json'
            or any(not part or part in ('.', '..') or '\\' in part or '\x00' in part for part in parts)):
        raise ValueError('Invalid canonical bundle path')
    if any(len(part.encode()) > 128 or re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', part) is None for part in parts[2:4]):
        raise ValueError('Invalid canonical bundle component')
    numeric_values = ([row['id'] for row in metadata['codes']]
                      + [row['jurisdictionID'] for row in metadata['codes']]
                      + [row['id'] for row in metadata['jurisdictions']]
                      + [row[key] for row in metadata['codeSections'] for key in ('codeID', 'id')])
    if any(type(value) is not int or not -(2**63) <= value < 2**63 for value in numeric_values):
        raise ValueError('Source identifiers must be Int64 values')
    codes = {row['id']: row for row in metadata['codes']}
    jurisdictions = {row['id'] for row in metadata['jurisdictions']}
    if len(codes) != len(metadata['codes']) or len(jurisdictions) != len(metadata['jurisdictions']):
        raise ValueError('Duplicate code or jurisdiction identity')
    if any(code['jurisdictionID'] not in jurisdictions for code in codes.values()):
        raise ValueError('Unknown jurisdiction')
    sources, seen = [], set()
    for category in metadata['codeSections']:
        code = codes[category['codeID']]
        jurisdiction = code['jurisdictionID']
        if jurisdiction not in jurisdictions:
            raise ValueError('Unknown jurisdiction')
        identity = dict(canonicalEdition=f'{bundle_path}#{code["id"]}',
                        jurisdictionID=jurisdiction, codeID=code['id'], categoryID=category['id'])
        key = json.dumps(identity, sort_keys=True)
        if key in seen:
            raise ValueError(f'Duplicate source identity: {identity}')
        seen.add(key)
        sources.append(identity)
    if not sources:
        raise ValueError('No source identities')
    return sources


def catalog(resource_root):
    authored = resource_root / 'CodeContent' / 'authored'
    packs, seen = [], set()
    for path in sorted(authored.glob('*/*/bundle.json')):
        bundle_path = path.relative_to(resource_root).as_posix()
        sources = canonical_sources(json.loads(path.read_text()), bundle_path)
        for identity in sources:
            key = json.dumps(identity, sort_keys=True)
            if key in seen:
                raise ValueError(f'Duplicate source identity: {identity}')
            seen.add(key)
        packs.append(dict(packID=path.parent.name, bundlePath=bundle_path, sources=sources))
    if not packs:
        raise ValueError('No authored packs found')
    return dict(schemaVersion=1, purpose='isolated catalog prototype; no download activation', packs=packs)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('resource_root', type=Path)
    args = parser.parse_args()
    print(json.dumps(catalog(args.resource_root), indent=2))
