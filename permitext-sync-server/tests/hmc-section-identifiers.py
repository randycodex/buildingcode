"""Actual enacted headings and prepared web metadata keep one canonical identifier."""
import importlib.util
import json
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('hmc_importer', ROOT / 'permitext-sync-server/scripts/import-nyc-enacted-admin-code.py')
importer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = importer
spec.loader.exec_module(importer)
BASE = ROOT / 'NYC CC APP/permitext/Resources/CodeContent/authored/new-york-city/2026-enacted-administrative-code'

def read(name):
    return json.loads((BASE / 'prepared' / name).read_text())

class HMCSectionIdentifiers(unittest.TestCase):
    def test_actual_source_and_all_prepared_views(self):
        source = (BASE / 'chapters/30000078.html').read_text()
        chapter = read('chapters/30000078.json')
        compact = read('chapterCatalog.json')
        def rows(value):
            if isinstance(value, dict):
                yield value
                for child in value.values(): yield from rows(child)
            elif isinstance(value, list):
                yield value
                for child in value: yield from rows(child)
        for sid, number, title in [(31001869,'27-2017.4','Violation for pests'),(31001873,'27-2017.8','Integrated pest management practices.')]:
            heading = re.search(fr'<section id="section-{sid}"><h3>(.*?)</h3>', source).group(1)
            self.assertIn('27- ', heading)
            self.assertEqual(importer.section_heading_parts(heading), (number,title))
            detail = read(f'sections/{sid}.json')
            self.assertEqual((detail['sectionNumber'],detail['title']), (number,title))
            self.assertEqual(detail['sectionID'],sid)
            self.assertEqual(detail['chapterID'],30000078)
            catalog = next(s for s in read('sectionCatalog.json')['sections'] if s['id']==sid)
            summary = next(s for s in rows(chapter) if isinstance(s,dict) and s.get('id')==sid)
            packed = next(s for s in rows(compact) if isinstance(s,list) and s and s[0]==sid)
            for row in [catalog,summary]: self.assertEqual((row['sectionNumber'],row['title']),(number,title))
            self.assertEqual(packed[1:3],[number,title])
            self.assertEqual(read('section-map.json')[f'HMC:2:{number}'],sid)
            self.assertIn(sid,read('searchIndex.json')['tokens'][number])
        self.assertNotIn('HMC:2:27-',read('section-map.json'))
    def test_existing_heading_forms_and_title_text(self):
        for heading,expected in [('27-2017.4 Violation for pests',('27-2017.4','Violation for pests')),('27-2017.4. Violation for pests',('27-2017.4','Violation for pests')),('27-2005 Duties 2. 3 remain text',('27-2005','Duties 2. 3 remain text')),('L.L. 2026/047 Example',('L.L. 2026/047','Example'))]:
            self.assertEqual(importer.section_heading_parts(heading),expected)

if __name__ == '__main__': unittest.main()
