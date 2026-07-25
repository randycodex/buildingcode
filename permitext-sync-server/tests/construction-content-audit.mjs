import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parse } from "parse5";
import {
  constructionChapterHeadingDetails,
  constructionChapterHeadingNumbers,
  constructionChapterHTMLSource,
  constructionContentRoot,
  constructionHTMLBodyForSection
} from "../construction-html-content.mjs";

const preparedRoot = join(constructionContentRoot, "prepared");
const preparedChaptersRoot = join(preparedRoot, "chapters");
const legacyPreparedSectionsRoot = resolve(
  constructionContentRoot,
  "../../../../../../NYCCCApp/Resources/CodeContent/authored/new-york-city/2022-construction-codes/prepared/sections"
);

const codeBySectionID = new Map([
  [1, { prefix: "BC", slug: "building-code", chapterCount: 58 }],
  [3, { prefix: "AC", slug: "general-administrative-provisions", chapterCount: 5 }],
  [4, { prefix: "FGC", slug: "fuel-gas-code", chapterCount: 15 }],
  [5, { prefix: "PC", slug: "plumbing-code", chapterCount: 22 }],
  [6, { prefix: "MC", slug: "mechanical-code", chapterCount: 18 }]
]);

const minimumHTMLCoverageByPrefix = Object.freeze({
  BC: 6_694,
  AC: 1_269,
  FGC: 772,
  MC: 1_369,
  PC: 1_140
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function normalizeTextKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeSectionNumber(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/\.$/, "")
    .toUpperCase();
}

function nodeText(node) {
  if (node.nodeName === "#text") return node.value || "";
  return (node.childNodes || []).map(nodeText).join("");
}

function elementAttribute(node, name) {
  return node.attrs?.find((attribute) => attribute.name === name)?.value || "";
}

function collectDocumentFacts(node, facts = { headings: [], localReferences: [] }) {
  if (/^h[1-6]$/.test(node.nodeName)) {
    facts.headings.push(nodeText(node).replace(/\s+/g, " ").trim());
  }
  const reference =
    node.nodeName === "img" ? elementAttribute(node, "src") :
      node.nodeName === "link" ? elementAttribute(node, "href") :
        node.nodeName === "script" ? elementAttribute(node, "src") :
          "";
  if (reference && !/^(?:data:|https?:|\/\/|#|javascript:)/i.test(reference)) {
    facts.localReferences.push(reference);
  }
  for (const child of node.childNodes || []) {
    collectDocumentFacts(child, facts);
  }
  return facts;
}

function expectedChapterHeading(chapter) {
  const chapterNumber = String(chapter.chapterNumber);
  const label = /^\d+$/.test(chapterNumber) || /^[A-Z]+\d+$/i.test(chapterNumber)
    ? "Chapter"
    : "Appendix";
  return `${label} ${chapterNumber}: ${chapter.title}`;
}

async function assertFileExistsAndIsNonempty(path, context) {
  try {
    await access(path);
  } catch {
    throw new Error(`${context} points to a missing file: ${path}`);
  }
  assert((await stat(path)).size > 0, `${context} points to an empty file: ${path}`);
}

async function main() {
  const [bundle, manifest, preparedChapterFiles] = await Promise.all([
    readJSON(join(constructionContentRoot, "bundle.json")),
    readJSON(join(preparedRoot, "manifest.json")),
    readdir(preparedChaptersRoot)
  ]);

  assert(bundle.codeSections.length === codeBySectionID.size, "Construction bundle must contain all five code families.");
  assert(bundle.chapters.length === 118, `Construction chapter count changed from 118 to ${bundle.chapters.length}.`);
  assert(
    preparedChapterFiles.filter((file) => file.endsWith(".json")).length === bundle.chapters.length,
    "Every Construction chapter must have one prepared chapter catalog."
  );

  for (const [codeSectionID, expected] of codeBySectionID) {
    const section = bundle.codeSections.find((candidate) => candidate.id === codeSectionID);
    assert(section, `Construction bundle is missing code-section ID ${codeSectionID}.`);
    const chapterCount = bundle.chapters.filter((chapter) => chapter.codeSectionID === codeSectionID).length;
    assert(
      chapterCount === expected.chapterCount,
      `${expected.prefix} chapter count changed from ${expected.chapterCount} to ${chapterCount}.`
    );
  }

  const manifestByChapterID = new Map(
    manifest.chapters.map((chapter) => [Number(chapter.chapterID), chapter])
  );
  const bundleChapterByID = new Map(bundle.chapters.map((chapter) => [Number(chapter.id), chapter]));
  assert(manifestByChapterID.size === bundleChapterByID.size, "Bundle and prepared manifest chapter counts differ.");

  const sections = [];
  const sectionsByChapterID = new Map();
  for (const file of preparedChapterFiles.filter((candidate) => candidate.endsWith(".json"))) {
    const prepared = await readJSON(join(preparedChaptersRoot, file));
    const chapter = bundleChapterByID.get(Number(prepared.chapterID));
    const manifestChapter = manifestByChapterID.get(Number(prepared.chapterID));
    assert(chapter, `Prepared chapter ${prepared.chapterID} is absent from bundle.json.`);
    assert(manifestChapter, `Prepared chapter ${prepared.chapterID} is absent from prepared/manifest.json.`);
    assert(
      String(prepared.chapterNumber) === String(chapter.chapterNumber),
      `Prepared chapter ${prepared.chapterID} declares the wrong chapter number.`
    );
    const code = codeBySectionID.get(Number(chapter.codeSectionID));
    assert(code, `Prepared chapter ${prepared.chapterID} has an unsupported code-section ID.`);
    const chapterSections = (prepared.groups || []).flatMap((group) =>
      (group.sections || []).map((section) => ({
        ...section,
        chapterID: Number(chapter.id),
        chapterNumber: String(chapter.chapterNumber),
        chapterTitle: chapter.title,
        codePrefix: code.prefix
      }))
    );
    assert(
      chapterSections.length === Number(manifestChapter.sectionCount),
      `${code.prefix} Chapter ${chapter.chapterNumber} has ${chapterSections.length} catalog sections but the manifest declares ${manifestChapter.sectionCount}.`
    );
    for (const section of chapterSections) {
      assert(Number.isSafeInteger(Number(section.id)), `Chapter ${chapter.id} contains a nonnumeric section ID.`);
      assert(String(section.sectionNumber || "").trim(), `Section ${section.id} has no section number.`);
      assert(String(section.title || "").trim(), `Section ${section.id} has no display title.`);
    }
    sections.push(...chapterSections);
    sectionsByChapterID.set(Number(chapter.id), chapterSections);
  }
  assert(sections.length === 12_891, `Construction section count changed from 12,891 to ${sections.length}.`);
  assert(new Set(sections.map((section) => Number(section.id))).size === sections.length, "Construction section IDs are not unique.");
  assert(
    Number(bundle.nextSectionID) > Math.max(...sections.map((section) => Number(section.id))),
    "Construction bundle nextSectionID does not follow every published section ID."
  );

  const runtimeSources = new Map();
  const sourceForChapterID = new Map();
  let localReferenceCount = 0;
  for (const chapter of bundle.chapters) {
    const code = codeBySectionID.get(Number(chapter.codeSectionID));
    const source = await constructionChapterHTMLSource(code.prefix, chapter.chapterNumber);
    assert(source, `${code.prefix} Chapter ${chapter.chapterNumber} has no runtime HTML source.`);
    assert(
      source.path.includes(`/code-sections/${code.slug}/chapters/`),
      `${code.prefix} Chapter ${chapter.chapterNumber} resolved outside its own code family: ${source.path}`
    );
    sourceForChapterID.set(Number(chapter.id), source);

    let sourceFacts = runtimeSources.get(source.path);
    if (!sourceFacts) {
      await assertFileExistsAndIsNonempty(source.path, `${code.prefix} Chapter ${chapter.chapterNumber}`);
      sourceFacts = collectDocumentFacts(parse(source.html));
      runtimeSources.set(source.path, sourceFacts);
      for (const reference of sourceFacts.localReferences) {
        const resolvedReference = resolve(
          dirname(source.path),
          decodeURIComponent(reference.split(/[?#]/, 1)[0])
        );
        await assertFileExistsAndIsNonempty(resolvedReference, `${source.path} reference ${reference}`);
        localReferenceCount += 1;
      }
      for (let index = 1; index < sourceFacts.headings.length; index += 1) {
        assert(
          normalizeTextKey(sourceFacts.headings[index]) !== normalizeTextKey(sourceFacts.headings[index - 1]),
          `${source.path} contains adjacent duplicate headings: ${sourceFacts.headings[index]}`
        );
      }
    }

    const expectedHeadingKey = normalizeTextKey(expectedChapterHeading(chapter));
    const matchingChapterHeadings = sourceFacts.headings.filter(
      (heading) => normalizeTextKey(heading) === expectedHeadingKey
    );
    assert(
      matchingChapterHeadings.length === 1,
      `${code.prefix} Chapter ${chapter.chapterNumber} must present its chapter title exactly once in source HTML; found ${matchingChapterHeadings.length}.`
    );
  }
  assert(runtimeSources.size === 101, `Construction runtime source-file count changed from 101 to ${runtimeSources.size}.`);

  const chaptersBySourcePath = new Map();
  for (const chapter of bundle.chapters) {
    const source = sourceForChapterID.get(Number(chapter.id));
    chaptersBySourcePath.set(source.path, [
      ...(chaptersBySourcePath.get(source.path) || []),
      chapter
    ]);
  }
  const unmatchedSourceHeadings = [];
  let disambiguatedDuplicateHeadingCount = 0;
  for (const chapters of chaptersBySourcePath.values()) {
    const firstChapter = chapters[0];
    const code = codeBySectionID.get(Number(firstChapter.codeSectionID));
    const catalogNumbers = new Set(
      chapters.flatMap((chapter) => sectionsByChapterID.get(Number(chapter.id)) || [])
        .map((section) => normalizeSectionNumber(section.sectionNumber))
    );
    const sourceNumbers = await constructionChapterHeadingNumbers(code.prefix, firstChapter.chapterNumber);
    for (const sectionNumber of sourceNumbers) {
      if (!catalogNumbers.has(normalizeSectionNumber(sectionNumber))) {
        unmatchedSourceHeadings.push({
          codePrefix: code.prefix,
          chapterNumbers: chapters.map((chapter) => chapter.chapterNumber),
          sectionNumber
        });
      }
    }
    const sourceHeadingDetails = await constructionChapterHeadingDetails(
      code.prefix,
      firstChapter.chapterNumber
    );
    const sourceHeadingsByNumber = new Map();
    for (const heading of sourceHeadingDetails) {
      const key = normalizeSectionNumber(heading.sectionNumber);
      sourceHeadingsByNumber.set(key, [
        ...(sourceHeadingsByNumber.get(key) || []),
        heading
      ]);
    }
    for (const chapter of chapters) {
      for (const section of sectionsByChapterID.get(Number(chapter.id)) || []) {
        const matchingNumberHeadings = sourceHeadingsByNumber.get(
          normalizeSectionNumber(section.sectionNumber)
        ) || [];
        if (matchingNumberHeadings.length < 2) continue;
        const matchingTitleHeadings = matchingNumberHeadings.filter(
          (heading) => normalizeTextKey(heading.headingText) === normalizeTextKey(section.title)
        );
        assert(
          matchingTitleHeadings.length === 1,
          `${code.prefix} ${section.sectionNumber} (${section.id}) cannot be uniquely matched among duplicate official headings by its title: ${section.title}`
        );
        disambiguatedDuplicateHeadingCount += 1;
      }
    }
  }
  assert(
    unmatchedSourceHeadings.length === 0,
    `Runtime HTML contains unexpected headings absent from the section catalog: ${JSON.stringify(unmatchedSourceHeadings.slice(0, 20))}`
  );

  const htmlCoverageByPrefix = Object.fromEntries(
    [...new Set([...codeBySectionID.values()].map((code) => code.prefix))]
      .map((prefix) => [prefix, 0])
  );
  let htmlBodyCount = 0;
  let missingHTMLBodyCount = 0;
  for (const section of sections) {
    const body = await constructionHTMLBodyForSection(section);
    if (!body) {
      missingHTMLBodyCount += 1;
      continue;
    }
    htmlBodyCount += 1;
    htmlCoverageByPrefix[section.codePrefix] += 1;
    assert(body.blocks?.length === 1, `${section.codePrefix} ${section.sectionNumber} synthesized an invalid body.`);
    const plainText = String(body.blocks[0].plainText || "").trim();
    assert(plainText, `${section.codePrefix} ${section.sectionNumber} synthesized an empty body.`);
    const normalizedBodyStart = normalizeTextKey(plainText).slice(0, normalizeTextKey(section.title).length);
    assert(
      normalizedBodyStart !== normalizeTextKey(section.title),
      `${section.codePrefix} ${section.sectionNumber} repeats its display title at the start of its body.`
    );
  }
  const expectedPreparedCount = manifest.chapters.reduce(
    (count, chapter) => count + Number(chapter.preparedSectionCount || 0),
    0
  );
  assert(
    htmlBodyCount >= expectedPreparedCount,
    `Only ${htmlBodyCount} Construction sections can synthesize HTML bodies; the manifest expects ${expectedPreparedCount}.`
  );
  for (const [prefix, minimum] of Object.entries(minimumHTMLCoverageByPrefix)) {
    assert(
      htmlCoverageByPrefix[prefix] >= minimum,
      `${prefix} HTML body coverage regressed to ${htmlCoverageByPrefix[prefix]}; expected at least ${minimum}.`
    );
  }

  const administrativeChapter4 = bundle.chapters.find(
    (chapter) => chapter.codeSectionID === 3 && String(chapter.chapterNumber) === "4"
  );
  assert(administrativeChapter4?.id === 77, "General Administrative Provisions Chapter 4 identity changed.");
  const administrativeApplication = sectionsByChapterID.get(77)
    ?.find((section) => section.sectionNumber === "28-401.1");
  assert(administrativeApplication?.id === 9810, "Administrative section 28-401.1 identity changed.");
  const administrativeBody = await constructionHTMLBodyForSection(administrativeApplication);
  assert(
    administrativeBody?.sourceHTMLPath ===
      "code-sections/general-administrative-provisions/chapters/Chapter 4.html",
    "Administrative Chapter 4 is not using its own official HTML source."
  );
  const administrativeText = administrativeBody.blocks.map((block) => block.plainText || "").join(" ");
  assert(
    administrativeText.includes(
      "This chapter shall apply to the licensing and registration of businesses, trades and occupations engaged in building work regulated by this code."
    ),
    "Administrative section 28-401.1 is missing its provision body."
  );
  assert(
    !normalizeTextKey(administrativeText).startsWith(normalizeTextKey(administrativeChapter4.title)) &&
      !normalizeTextKey(administrativeText).startsWith(normalizeTextKey(administrativeApplication.title)),
    "Administrative Chapter 4 repeats a chapter or section title inside its provision body."
  );

  const mechanicalChapter4 = bundle.chapters.find((chapter) =>
    codeBySectionID.get(Number(chapter.codeSectionID))?.prefix === "MC" &&
    String(chapter.chapterNumber) === "4"
  );
  const mechanicalParkingGarage = sectionsByChapterID.get(Number(mechanicalChapter4?.id))
    ?.find((section) => section.sectionNumber === "404.1");
  assert(mechanicalParkingGarage?.id === 10442, "Mechanical section 404.1 identity changed.");
  const mechanicalParkingGarageBody = await constructionHTMLBodyForSection(mechanicalParkingGarage);
  const mechanicalParkingGarageText = mechanicalParkingGarageBody?.blocks
    ?.map((block) => block.plainText || "")
    .join(" ") || "";
  assert(
    mechanicalParkingGarageText.includes(
      "such operation shall be automatic by means of carbon monoxide detectors applied in conjunction with nitrogen dioxide detectors"
    ),
    "Mechanical section 404.1 is missing its official enclosed-parking-garage provision body."
  );
  assert(
    !mechanicalParkingGarageText.includes("spray booth"),
    "Mechanical section 404.1 resolved to a stale legacy spray-operations body."
  );

  const buildingChapter9 = bundle.chapters.find((chapter) =>
    codeBySectionID.get(Number(chapter.codeSectionID))?.prefix === "BC" &&
    String(chapter.chapterNumber) === "9"
  );
  const flammableGasSection = sectionsByChapterID.get(Number(buildingChapter9?.id))
    ?.find((section) => section.sectionNumber === "908.10");
  assert(
    flammableGasSection?.title.includes("Flammable gas"),
    "Building Code section 908.10 identity changed."
  );
  const naturalGasAlarmSection = {
    ...flammableGasSection,
    id: -90810,
    title: "908.10 Natural gas alarms.* [Repealed]"
  };
  const [flammableGasBody, naturalGasAlarmBody] = await Promise.all([
    constructionHTMLBodyForSection(flammableGasSection),
    constructionHTMLBodyForSection(naturalGasAlarmSection)
  ]);
  const flammableGasText = flammableGasBody?.blocks?.map((block) => block.plainText || "").join(" ") || "";
  const naturalGasAlarmText = naturalGasAlarmBody?.blocks?.map((block) => block.plainText || "").join(" ") || "";
  assert(
    flammableGasText.includes("Rooms and spaces containing flammable gas distribution piping"),
    "The first Building Code 908.10 designation resolved to the wrong duplicate heading."
  );
  assert(
    naturalGasAlarmText.includes("Repealed L.L. 2025/102"),
    "The second Building Code 908.10 designation resolved to the wrong duplicate heading."
  );
  assert(
    !naturalGasAlarmText.includes("Rooms and spaces containing flammable gas distribution piping"),
    "Duplicate Building Code 908.10 provisions were merged or misidentified."
  );

  const appendixU = bundle.chapters.find(
    (chapter) => chapter.codeSectionID === 1 && String(chapter.chapterNumber) === "U"
  );
  const departmentRules = sectionsByChapterID.get(Number(appendixU?.id))
    ?.find((section) => section.sectionNumber === "U101.5");
  assert(departmentRules?.id === 25651, "Building Code Appendix U section U101.5 identity changed.");
  const legacyPreparedSectionFiles = new Set(await readdir(legacyPreparedSectionsRoot));
  assert(
    !legacyPreparedSectionFiles.has(`${departmentRules.id}.json`),
    "Building Code Appendix U section U101.5 collides with a legacy prepared-body identity."
  );
  const departmentRulesBody = await constructionHTMLBodyForSection(departmentRules);
  assert(
    departmentRulesBody?.blocks?.some((block) =>
      block.plainText?.includes(
        "The department shall consult with the fire department and the office of emergency management"
      )
    ),
    "Building Code Appendix U section U101.5 is missing its official provision body."
  );

  for (const groupedChapterNumber of ["K1", "K2", "K3"]) {
    const source = await constructionChapterHTMLSource("BC", groupedChapterNumber);
    assert(
      source.path.endsWith("/code-sections/building-code/chapters/K.html"),
      `BC ${groupedChapterNumber} did not resolve to the complete packaged Appendix K source.`
    );
  }

  console.log("permitext construction content audit passed", {
    codeFamilies: bundle.codeSections.length,
    chapters: bundle.chapters.length,
    sections: sections.length,
    runtimeHTMLSources: runtimeSources.size,
    localAssetAndStylesheetReferences: localReferenceCount,
    sectionsWithHTMLBodies: htmlBodyCount,
    htmlBodies: htmlBodyCount,
    titleOnlyOrNestedCatalogEntries: missingHTMLBodyCount,
    htmlCoverageByPrefix,
    duplicateAdjacentHeadings: 0,
    duplicateOfficialHeadingsDisambiguatedByTitle: disambiguatedDuplicateHeadingCount,
    administrativeChapter4TitleOccurrences: 1
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
