#!/usr/bin/env python3
"""Read-only source-resource inventory. Compression estimates are not App Store sizes."""
import argparse
import hashlib
import json
from pathlib import Path
import zlib


def inventory(root):
    packs = []
    for manifest in sorted(root.glob('authored/*/*/bundle.json')):
        pack = manifest.parent
        metadata = json.loads(manifest.read_text())
        groups = {}
        digest = hashlib.sha256()
        count = 0
        for path in sorted(pack.rglob('*')):
            if not path.is_file():
                continue
            relative = path.relative_to(pack).as_posix()
            data = path.read_bytes()
            group = relative.split('/')[0] if '/' in relative else 'metadata'
            record = groups.setdefault(group, {'files': 0, 'logicalBytes': 0, 'zlibLevel6Bytes': 0})
            record['files'] += 1
            record['logicalBytes'] += len(data)
            record['zlibLevel6Bytes'] += len(zlib.compress(data, 6))
            digest.update(relative.encode() + b'\0' + hashlib.sha256(data).digest())
            count += 1
        packs.append({
            'pack': pack.relative_to(root).as_posix(),
            'codes': [{'id': c['id'], 'name': c['name']} for c in metadata.get('codes', [])],
            'files': count, 'contentInventorySHA256': digest.hexdigest(), 'groups': groups,
            'logicalBytes': sum(g['logicalBytes'] for g in groups.values()),
            'zlibLevel6Bytes': sum(g['zlibLevel6Bytes'] for g in groups.values()),
            'proposedDefault': pack.name in ('2014-construction-codes', '2022-construction-codes')
        })
    return {'schemaVersion': 1,
            'scope': 'Source CodeContent authored packs; excludes executable/shared resources, signing, filesystem allocation and runtime caches.',
            'compression': 'Sum of independent zlib level6 streams per file; comparative estimate only, not IPA/App Store download size.',
            'packs': packs,
            'totals': {name: {'logicalBytes': sum(p['logicalBytes'] for p in packs if predicate(p)),
                              'zlibLevel6Bytes': sum(p['zlibLevel6Bytes'] for p in packs if predicate(p))}
                       for name, predicate in [('all', lambda p: True), ('proposedDefaults', lambda p: p['proposedDefault']), ('optional', lambda p: not p['proposedDefault'])]}}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2] / 'NYC CC APP/permitext/Resources/CodeContent')
    args = parser.parse_args()
    print(json.dumps(inventory(args.root), indent=2))
