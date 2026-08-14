import { access, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  constructionContentRoot,
  constructionHTMLBodyForSection,
  constructionImageAssetNames,
  officialBodyHasUnboundImages
} from "../construction-html-content.mjs";

const serverRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const authoredSectionsRoot = join(constructionContentRoot, "prepared", "sections");
const assetRoot = join(constructionContentRoot, "assets");
const legacySectionsRoot = join(
  serverRoot,
  "..",
  "NYC CC APP",
  "NYCCCApp",
  "Resources",
  "CodeContent",
  "authored",
  "new-york-city",
  "2022-construction-codes",
  "prepared",
  "sections"
);

const expectedBindings = Object.freeze([
  {
    codePrefix: "PC",
    sectionID: 12189,
    chapterNumber: "6",
    sectionNumber: "606.5.4",
    title: "606.5.4 Overflows for water supply tanks.",
    provisionText: "gravity or suction water supply tank shall be provided with an overflow",
    assets: ["plumbing-code-figure-606-5-4-methods-of-connecting-overflow-from-gravity-house-and-suction-water-supply-tanks.png"]
  },
  {
    codePrefix: "PC",
    sectionID: 12230,
    chapterNumber: "6",
    sectionNumber: "608.8.1",
    title: "608.8.1 Signage required.",
    provisionText: "shall appear on the required signage",
    assets: ["plumbing-code-figure-608-8-1-pictograph-do-not-drink.png"]
  },
  {
    codePrefix: "PC",
    sectionID: 12339,
    chapterNumber: "7",
    sectionNumber: "704.6",
    title: "704.6 Suds Pressure Zones Vents.",
    provisionText: "suds pressure zone",
    assets: ["plumbing-code-figure-704-6-suds-pressure-zones.png"]
  },
  {
    codePrefix: "PC",
    sectionID: 12653,
    chapterNumber: "11",
    sectionNumber: "1101.5.2.1",
    title: "1101.5.2.1 Emergency overflow.",
    provisionText: "emergency overflow",
    assets: [
      "plumbing-code-figure-1101-5-2-1-1-detention-volume-and-tank-above-grade-within-building.jpg",
      "plumbing-code-figure-1101-5-2-1-2-detention-volume-above-sewer-tank-below-grade-within-building.jpg",
      "plumbing-code-figure-1101-5-2-1-3-detention-volume-and-tank-below-grade-within-building.jpg"
    ]
  },
  {
    codePrefix: "PC",
    sectionID: 12726,
    chapterNumber: "11",
    sectionNumber: "1114.4",
    title: "1114.4 Required components.",
    provisionText: "grit chamber",
    assets: [
      "plumbing-code-figure-1114-4-1-grit-chamber.png",
      "plumbing-code-figure-1114-4-2-detail-of-drywell-with-sand-column.png"
    ]
  },
  {
    codePrefix: "PC",
    sectionID: 12748,
    chapterNumber: "13",
    sectionNumber: "1301.3.2",
    title: "1301.3.2 Signage required.",
    provisionText: "shall appear on the signage required by this section",
    assets: ["plumbing-code-figure-1301-3-pictograph-do-not-drink.png"]
  },
  {
    codePrefix: "PC",
    sectionID: 11717,
    chapterNumber: "E",
    sectionNumber: "E103.3",
    title: "E103.3 Segmented loss method.",
    provisionText: "Figure E103",
    assets: [
      "plumbing-code-figure-e103-3-1-example-sizing.jpg",
      "plumbing-code-figure-e103-3-2-friction-loss-in-smooth-pipe.png",
      "plumbing-code-figure-e103-3-3-friction-loss-in-smooth-pipe.png",
      "plumbing-code-figure-e103-3-5-friction-loss-in-fairly-smooth-pipe.png",
      "plumbing-code-figure-e103-3-6-friction-loss-in-fairly-rough-pipe.png",
      "plumbing-code-figure-e103-3-7-friction-loss-in-rough-pipe.png"
    ]
  },
  {
    codePrefix: "FGC",
    sectionID: 8091,
    chapterNumber: "3",
    sectionNumber: "304.5.3",
    title: "304.5.3 Indoor opening size and location.",
    provisionText: "Openings used to connect indoor spaces",
    assets: ["fuel-gas-code-figure-304-5-3-all-air-from-inside-the-building-see-section-304-5-3.png"]
  },
  {
    codePrefix: "FGC",
    sectionID: 8096,
    chapterNumber: "3",
    sectionNumber: "304.6.2",
    title: "304.6.2 One-permanent-opening method.",
    provisionText: "one permanent opening",
    assets: ["fuel-gas-code-figure-304-6-2-single-combustion-air-opening-all-air-from-the-outdoors-see-section-304-6-2.jpg"]
  },
  {
    codePrefix: "FGC",
    sectionID: 8146,
    chapterNumber: "3",
    sectionNumber: "308.2",
    title: "308.2 Reduction table.",
    provisionText: "clearances",
    assets: [
      "fuel-gas-code-figure-308-2-1-extent-of-protection-necessary-to-reduce-clearances-from-appliance-or-vent-connections.jpg",
      "fuel-gas-code-figure-308-2-1-extent-of-protection-necessary-to-reduce-clearances-from-appliance-or-vent-connections-2.jpg",
      "fuel-gas-code-figure-308-2-2-wall-protector-clearance-reduction-system.jpg"
    ]
  },
  {
    codePrefix: "FGC",
    sectionID: 8176,
    chapterNumber: "4",
    sectionNumber: "402.4",
    title: "402.4 Sizing tables and equations.",
    provisionText: "Equation 4-1",
    assets: [
      "fuel-gas-code-401-10-chapter-4-image-1.jpg",
      "fuel-gas-code-401-10-chapter-4-image-2.jpg"
    ]
  },
  {
    codePrefix: "FGC",
    sectionID: 8324,
    chapterNumber: "4",
    sectionNumber: "408.4",
    title: "408.4 Sediment trap.",
    provisionText: "sediment trap",
    assets: ["fuel-gas-code-figure-408-4-method-of-installing-a-tee-fitting-sediment-trap.jpg"]
  },
  {
    codePrefix: "FGC",
    sectionID: 8473,
    chapterNumber: "5",
    sectionNumber: "503.5.4",
    title: "503.5.4 Chimney termination.",
    provisionText: "chimney",
    assets: ["fuel-gas-code-figure-503-5-4-typical-termination-locations-for-chimneys-and-single-wall-metal-pipes-serving-residential.png"]
  },
  {
    codePrefix: "FGC",
    sectionID: 8494,
    chapterNumber: "5",
    sectionNumber: "503.6.4",
    title: "503.6.4 Gas vent terminations.",
    provisionText: "vent",
    assets: ["fuel-gas-code-503-4-2-5-chapter-5-image-2.jpg"]
  },
  {
    codePrefix: "FGC",
    sectionID: 8551,
    chapterNumber: "5",
    sectionNumber: "503.10.4.1",
    title: "503.10.4.1 Two or more openings.",
    provisionText: "openings",
    assets: ["fuel-gas-code-figure-503-10-4-1-opposing-openings-in-chimney.jpg"]
  },
  {
    codePrefix: "FGC",
    sectionID: 8601,
    chapterNumber: "5",
    sectionNumber: "504.3.4",
    title: "504.3.4 Vent connector manifold.",
    provisionText: "manifold",
    assets: ["fuel-gas-code-figure-504-3-4-use-of-a-manifold-common-vent-connector.jpg"]
  },
  {
    codePrefix: "MC",
    sectionID: 10208,
    chapterNumber: "A",
    sectionNumber: "A",
    title: "Appendix A: Chimney Connector Pass-Throughs",
    provisionText: "Chimney Connector",
    assets: ["mechanical-code-figure-a.jpg", "mechanical-code-figure-a-2.jpg"]
  },
  {
    codePrefix: "MC",
    sectionID: 10210,
    chapterNumber: "C",
    sectionNumber: "C101.1",
    title: "C101.1 Scope.",
    provisionText: "this appendix and the provisions in Section 1305",
    assets: [
      "mechanical-code-figure-c101-1-1-primary-tank-ul-80-asme-bpvc-or-nyc-alternate-tank-day-tank-ul-80-asme-bpvc-or-nyc-alter.jpg",
      "mechanical-code-figure-c101-1-2-primary-tank-ul-142-or-dual-label-tank-day-tank-ul-142-or-dual-label-tank.jpg",
      "mechanical-code-figure-c101-1-3-primary-tank-ul-80-asme-bpvc-or-nyc-alternate-tank-day-tank-ul-142-or-dual-label-tank.jpg"
    ]
  }
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJSON(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function bodyText(body) {
  return (body?.blocks || []).map((block) => block.plainText || "").join(" ");
}

async function main() {
  const expectedAssets = expectedBindings.flatMap((binding) => binding.assets);
  assert(expectedAssets.length === 32, `Expected 32 rebound construction figures, found ${expectedAssets.length}.`);
  assert(new Set(expectedAssets).size === 32, "Expected figure filenames are not unique.");

  const ownership = new Map();
  for (const binding of expectedBindings) {
    const official = await constructionHTMLBodyForSection({
      ...binding,
      id: binding.sectionID
    });
    assert(official, `${binding.codePrefix} ${binding.sectionNumber} has no official HTML body.`);
    const names = constructionImageAssetNames(official.blocks);
    for (const asset of binding.assets) {
      assert(names.includes(asset), `${binding.codePrefix} ${binding.sectionNumber} is missing official figure ${asset}.`);
      assert(!ownership.has(asset) || ownership.get(asset) === binding.sectionID, `${asset} is bound to more than one section.`);
      ownership.set(asset, binding.sectionID);
      const assetPath = join(assetRoot, asset);
      assert(await exists(assetPath), `Referenced figure is missing: ${asset}`);
      assert((await stat(assetPath)).size > 0, `Referenced figure is empty: ${asset}`);
    }
    const text = bodyText(official);
    assert(
      text.toLowerCase().includes(binding.provisionText.toLowerCase()),
      `${binding.codePrefix} ${binding.sectionNumber} official body is the wrong provision.`
    );
    assert(
      !/backflow in accordance with Section 608\.15|Temperature actuated mixing valves|change of horizontal direction greater than 45 degrees|continuously bonded electrically/i.test(text),
      `${binding.codePrefix} ${binding.sectionNumber} still contains unrelated prepared-JSON provision text.`
    );

    const authored = await readJSON(join(authoredSectionsRoot, `${binding.sectionID}.json`));
    assert(
      Number(authored.sectionID) === binding.sectionID,
      `${binding.codePrefix} ${binding.sectionNumber} authored body declares the wrong section ID.`
    );
    assert(
      authored.sourceHTMLPath && authored.sourceHTMLPath === official.sourceHTMLPath,
      `${binding.codePrefix} ${binding.sectionNumber} authored body is not the official chapter HTML extraction.`
    );
    assert(
      !officialBodyHasUnboundImages(authored, official),
      `${binding.codePrefix} ${binding.sectionNumber} authored body is missing an official figure.`
    );
    assert(
      bodyText(authored).toLowerCase().includes(binding.provisionText.toLowerCase()),
      `${binding.codePrefix} ${binding.sectionNumber} authored body is the wrong provision.`
    );

    if (await exists(join(legacySectionsRoot, `${binding.sectionID}.json`))) {
      const legacy = await readJSON(join(legacySectionsRoot, `${binding.sectionID}.json`));
      assert(
        officialBodyHasUnboundImages(legacy, official),
        `${binding.codePrefix} ${binding.sectionNumber} no longer demonstrates the legacy-JSON shadowing defect.`
      );
    }
  }

  console.log("permitext construction figure binding passed", {
    sections: expectedBindings.length,
    figures: expectedAssets.length
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
