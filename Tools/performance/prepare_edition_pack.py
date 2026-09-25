#!/usr/bin/env python3
"""Export an unchanged authored pack to a new temporary prototype directory."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from edition_pack_catalog import canonical_sources


def prepare(source, destination, bundle_path=None):
    if destination.exists():
        raise ValueError('Destination must not exist')
    if source.is_symlink():
        raise ValueError('Symlink source is unsupported')
    source = source.resolve(strict=True)
    destination = destination.absolute()
    if destination == source or source in destination.parents:
        raise ValueError('Destination must be outside the source')
    if bundle_path is None:
        resource_root = Path(__file__).resolve().parents[2] / 'NYC CC APP/permitext/Resources'
        bundle_path = (source / 'bundle.json').relative_to(resource_root).as_posix()
    metadata = json.loads((source / 'bundle.json').read_text())
    identities = canonical_sources(metadata, bundle_path)
    if bundle_path.split('/')[-2] != source.name:
        raise ValueError('Pack directory does not match canonical bundle path')
    entries = []
    for path in sorted(source.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symlink content is unsupported')
        if path.is_file():
            data = path.read_bytes()
            entries.append({'path': path.relative_to(source).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    if any(e['path'] == 'manifest.json' for e in entries):
        raise ValueError('Reserved manifest path')
    revision_inputs = {'bundlePath': bundle_path, 'files': entries, 'sourceIdentities': identities, 'readerCompatibility': 'prototype-v1'}
    revision = hashlib.sha256(json.dumps(revision_inputs, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    manifest = {'schemaVersion': 2, 'bundlePath': bundle_path, 'readerCompatibility': 'prototype-v1', 'packID': source.name, 'revision': revision, 'sourceIdentities': identities, 'files': entries}
    encoded = json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()
    shutil.copytree(source, destination)
    (destination / 'manifest.json').write_bytes(encoded)
    return {'packID': source.name, 'revision': revision, 'expectedManifestDigest': hashlib.sha256(encoded).hexdigest(),
            'files': len(entries), 'logicalBytes': sum(e['bytes'] for e in entries), 'manifestBytes': len(encoded)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--bundle-path', help='Canonical resource-relative bundle.json identity for external fixtures')
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.destination, args.bundle_path), indent=2))
