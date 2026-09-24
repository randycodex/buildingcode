#!/usr/bin/env python3
"""Export an unchanged authored pack to a new temporary prototype directory."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path


def prepare(source, destination):
    if destination.exists():
        raise ValueError('Destination must not exist')
    if source.is_symlink():
        raise ValueError('Symlink source is unsupported')
    source = source.resolve(strict=True)
    destination = destination.absolute()
    if destination == source or source in destination.parents:
        raise ValueError('Destination must be outside the source')
    metadata = json.loads((source / 'bundle.json').read_text())
    entries = []
    for path in sorted(source.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symlink content is unsupported')
        if path.is_file():
            data = path.read_bytes()
            entries.append({'path': path.relative_to(source).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    if any(e['path'] == 'manifest.json' for e in entries):
        raise ValueError('Reserved manifest path')
    # Prototype namespaced identities retain category/code IDs; production must map
    # these to the existing canonical server edition identities before integration.
    identities = [f"prototype:{source.name}:code:{c['codeID']}:category:{c['id']}" for c in metadata['codeSections']]
    revision = hashlib.sha256(json.dumps(entries, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    manifest = {'schemaVersion': 1, 'packID': source.name, 'revision': revision, 'sourceIdentities': identities, 'files': entries}
    encoded = json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()
    shutil.copytree(source, destination)
    (destination / 'manifest.json').write_bytes(encoded)
    return {'packID': source.name, 'revision': revision, 'expectedManifestDigest': hashlib.sha256(encoded).hexdigest(),
            'files': len(entries), 'logicalBytes': sum(e['bytes'] for e in entries), 'manifestBytes': len(encoded)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    print(json.dumps(prepare(args.source, args.destination), indent=2))
