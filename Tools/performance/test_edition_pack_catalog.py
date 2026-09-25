#!/usr/bin/env python3
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from edition_pack_catalog import catalog

ROOT = Path(__file__).resolve().parents[2]
RESOURCES = ROOT / 'NYC CC APP/permitext/Resources'

class CatalogTests(unittest.TestCase):
    def test_actual_corpus_and_native_identity(self):
        result = catalog(RESOURCES)
        self.assertEqual(len(result['packs']), 6)
        identities = [identity for pack in result['packs'] for identity in pack['sources']]
        self.assertEqual(len(identities), 22)
        models = (ROOT / 'NYC CC APP/permitext/Models/CodeModels.swift').read_text()
        expected = set(re.findall(r'static let canonicalNYC\w*\s*=\s*"([^"]+)"', models))
        self.assertEqual({i['canonicalEdition'] for i in identities}, expected)
        source = (ROOT / 'NYC CC APP/permitext/Models/ActiveCodeSources.swift').read_text()
        identity_type = source[source.index('struct ActiveCodeSourceIdentity:'):source.index('/// Preference only:')]
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            data = directory / 'sources.json'; data.write_text(json.dumps(identities))
            swift = directory / 'main.swift'
            swift.write_text('import Foundation\n' + identity_type + '''
let bytes = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let identities = try JSONDecoder().decode([ActiveCodeSourceIdentity].self, from: bytes)
precondition(identities.count == 22 && Set(identities).count == 22)
let roundtrip = try JSONDecoder().decode([ActiveCodeSourceIdentity].self, from: JSONEncoder().encode(identities.sorted()))
precondition(Set(roundtrip) == Set(identities))
''')
            binary = directory / 'check'
            subprocess.run(['xcrun', 'swiftc', str(swift), '-o', str(binary)], check=True)
            subprocess.run([str(binary), str(data)], check=True)

    def test_invalid_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle = root / 'CodeContent/authored/test/edition/bundle.json'
            bundle.parent.mkdir(parents=True)
            metadata = {'codes':[{'id':1,'jurisdictionID':1}], 'jurisdictions':[{'id':1}],
                        'codeSections':[{'codeID':1,'id':1},{'codeID':1,'id':1}]}
            bundle.write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, 'Duplicate source'): catalog(root)
            metadata['codeSections'].pop(); metadata['jurisdictions'] = []
            bundle.write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, 'Unknown jurisdiction'): catalog(root)

if __name__ == '__main__': unittest.main()
