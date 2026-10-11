import assert from 'node:assert/strict';
import {constructionHTMLBodyForSection} from '../construction-html-content.mjs';
import {savedExportSourceText} from '../report-evidence.mjs';
const section={id:1,chapterID:1,chapterNumber:'10',codePrefix:'BC',sectionNumber:'1020.6',title:'Corridor continuity.'};
const body=await constructionHTMLBodyForSection(section);
assert.ok(body,'Actual enacted-source fixture must resolve');
const text=savedExportSourceText(body);
assert.match(text,/Fire-resistance-rated corridors shall be continuous/);
assert.match(text,/length of the connecting corridor on the adjacent floor leading to the exit/);
assert.match(text,/Foyers, lobbies or reception rooms/);
assert.match(text,/Enclosed elevator lobbies as permitted by Item 1 of Section 1016\.2/);
assert.doesNotMatch(text,/Section BC 1021|Egress Balconies/);
const following=await constructionHTMLBodyForSection({...section,id:2,sectionNumber:'1021.1',title:'General.'});
assert.match(savedExportSourceText(following),/Balconies used for egress purposes/);
// Each lost coverage entry was Reserved and had only the following banner as a
// false body. Explicit cases keep the corpus audit's lower counts accountable.
const reserved = {
  BC: [['12', '1205.5'], ['12', '1208.4'], ['16', '1612.5'], ['3', '305.2'], ['30', '3007.9'], ['31', '3105.4']],
  PC: [['6', '605.25'], ['7', '706.4'], ['9', '903.7']],
  FGC: [['1', '103.4'], ['4', '412.8'], ['4', '413.8'], ['6', '621.7'], ['6', '626.2']],
  MC: [['4', '402.4'], ['11', '1106.6']]
};
for (const [codePrefix, provisions] of Object.entries(reserved)) {
  for (const [chapterNumber, sectionNumber] of provisions) {
    assert.equal(await constructionHTMLBodyForSection({
      ...section, codePrefix, chapterNumber, sectionNumber, title: `${sectionNumber} Reserved.`
    }), null, `${codePrefix} ${sectionNumber} must not inherit the next banner`);
  }
}
console.log('Construction boundaries passed: complete BC 1020.6 with both exceptions, no next-section banner, following provision preserved; 16 reserved provisions remain empty.');
