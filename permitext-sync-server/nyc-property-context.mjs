import { lookupMappedAreaFacts } from "./nyc-property-layers.mjs";
import { lookupNYCTaxLotGeometry } from "./nyc-tax-lot-geometry.mjs";

const nycPlanningSearchURL = "https://search-api-production.herokuapp.com/search/geosearch-v2";
const nycPlanningCartoSQLURL = "https://carto.nycplanningdigital.com/api/v2/sql";
const nycOpenDataPLUTOURL = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const lookupTimeoutMilliseconds = 12_000;
const cartoLookupTimeoutMilliseconds = 2_500;

const boroughNames = new Map([
  ["1", "Manhattan"],
  ["2", "Bronx"],
  ["3", "Brooklyn"],
  ["4", "Queens"],
  ["5", "Staten Island"],
  ["MN", "Manhattan"],
  ["BX", "Bronx"],
  ["BK", "Brooklyn"],
  ["QN", "Queens"],
  ["SI", "Staten Island"]
]);

const lotSQL = `
SELECT
  p.address,
  p.bbl,
  p.borough,
  p.borocode,
  p.block,
  p.lot,
  p.zipcode,
  p.cd,
  p.lotarea,
  p.lotfront,
  p.lotdepth,
  p.lottype,
  p.bldgarea,
  p.numbldgs,
  p.numfloors,
  p.unitsres,
  p.unitstotal,
  p.yearbuilt,
  p.yearalter1,
  p.yearalter2,
  p.bldgclass,
  p.landuse,
  p.overlay1,
  p.overlay2,
  p.spdist1,
  p.spdist2,
  p.spdist3,
  p.zonedist1,
  p.zonedist2,
  p.zonedist3,
  p.zonedist4,
  LOWER(p.zonemap) AS zonemap,
  p.trnstzone,
  p.ltdheight,
  p.histdist,
  p.landmark,
  p.version
FROM dcp_mappluto p
WHERE p.bbl = '__BBL__'
LIMIT 1
`;

export class NYCPropertyLookupError extends Error {
  constructor(message, { code = "NYC_PROPERTY_LOOKUP_FAILED", status = 502 } = {}) {
    super(message);
    this.name = "NYCPropertyLookupError";
    this.code = code;
    this.status = status;
  }
}

export function normalizedNYCPropertyAddress(value) {
  const address = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!address) {
    throw new NYCPropertyLookupError("Enter a New York City property address.", {
      code: "NYC_PROPERTY_ADDRESS_REQUIRED",
      status: 400
    });
  }
  if (address.length > 300) {
    throw new NYCPropertyLookupError("The property address is too long.", {
      code: "NYC_PROPERTY_ADDRESS_INVALID",
      status: 400
    });
  }
  return address;
}

async function fetchJSON(url, { fetchImpl = fetch, timeoutMilliseconds = lookupTimeoutMilliseconds } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response?.ok) {
      throw new NYCPropertyLookupError("NYC Planning property data is temporarily unavailable.");
    }
    return await response.json();
  } catch (error) {
    if (error instanceof NYCPropertyLookupError) throw error;
    if (error?.name === "AbortError") {
      throw new NYCPropertyLookupError("NYC Planning property lookup timed out.", {
        code: "NYC_PROPERTY_LOOKUP_TIMEOUT",
        status: 504
      });
    }
    throw new NYCPropertyLookupError("NYC Planning property data is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}

function validBBL(value) {
  const bbl = String(value ?? "").replace(/\.0+$/, "").trim();
  return /^\d{10}$/.test(bbl) ? bbl : "";
}

function addressSearchKey(value) {
  return String(value || "").split(",")[0].toUpperCase()
    .replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, "$1")
    .replace(/\bE\b/g, "EAST").replace(/\bW\b/g, "WEST")
    .replace(/\bN\b/g, "NORTH").replace(/\bS\b/g, "SOUTH")
    .replace(/\bST\b/g, "STREET").replace(/\bAVE\b/g, "AVENUE")
    .replace(/\bBLVD\b/g, "BOULEVARD").replace(/\bRD\b/g, "ROAD")
    .replace(/\b(?:BRONX|BROOKLYN|MANHATTAN|QUEENS|STATEN ISLAND)(?:\s+NY)?(?:\s+\d{5})?\s*$/g, "")
    .replace(/[.]/g, "").replace(/\s+/g, " ").trim();
}

function cartoSQLURL(sql) {
  const url = new URL(nycPlanningCartoSQLURL);
  url.searchParams.set("q", sql.replace(/\s+/g, " ").trim());
  return url;
}

function distinctValues(...values) {
  return Array.from(new Set(values.flat().map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formattedNumber(value, maximumFractionDigits = 0) {
  const number = numericValue(value);
  return number === null ? "" : new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(number);
}

function sourcedFact({ key, label, value, retrievedAt, bbl, dataset = "MapPLUTO" }) {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return null;
  return {
    id: `project-fact:${key}`,
    key,
    label,
    value: normalizedValue,
    status: "sourced",
    source: "nyc-planning",
    sourceText: `NYC Department of City Planning ${dataset}; BBL ${bbl}; retrieved ${retrievedAt.slice(0, 10)}.`,
    updatedAt: retrievedAt
  };
}

function standardizedAddress(lot, searchMatch) {
  const borough = boroughNames.get(String(lot.borocode || lot.borough || "").toUpperCase()) || "";
  const streetAddress = String(lot.address || "").trim();
  const zip = String(lot.zipcode || "").trim();
  if (streetAddress && borough) return `${streetAddress}, ${borough}, NY${zip ? ` ${zip}` : ""}`;
  return String(searchMatch?.label || "").replace(/,\s*USA\s*$/i, "").trim();
}

function communityDistrict(lot) {
  const code = String(lot.cd || "").padStart(3, "0");
  const borough = boroughNames.get(String(lot.borocode || lot.borough || "").toUpperCase());
  if (!/^\d{3}$/.test(code) || !borough) return "";
  return `${borough} ${Number(code.slice(1))}`;
}

function specialDistrictValue(codes, namesByCode) {
  return codes.map((code) => namesByCode.get(code) ? `${code} — ${namesByCode.get(code)}` : code).join(", ");
}

function mapPLUTOAreaFacts(lot, context) {
  const fields = [
    ["parking-geography", "Transit Zones Parking Geography", lot.trnstzone || lot.transitzone],
    ["limited-height-district", "Limited Height District", lot.ltdheight],
    ["historic-district", "Historic District", lot.histdist],
    ["landmark-status", "Landmark Designations", lot.landmark]
  ];
  return fields.flatMap(([key, label, value]) => value
    ? [sourcedFact({ key, label, value, ...context })] : []);
}

export function structuredFactsFromNYCPropertyData({ lot, specialDistricts = [], searchMatch = null, retrievedAt }) {
  const bbl = validBBL(lot?.bbl || searchMatch?.bbl);
  if (!bbl) throw new NYCPropertyLookupError("NYC Planning returned an invalid property identifier.");
  const borough = boroughNames.get(String(lot.borocode || lot.borough || "").toUpperCase()) || String(lot.borough || "").trim();
  const zoningDistricts = distinctValues(lot.zonedist1, lot.zonedist2, lot.zonedist3, lot.zonedist4);
  const overlays = distinctValues(lot.overlay1, lot.overlay2);
  const specialCodes = distinctValues(lot.spdist1, lot.spdist2, lot.spdist3);
  const namesByCode = new Map(specialDistricts.map((item) => [String(item.sdlbl || "").trim(), String(item.sdname || "").trim()]));
  const yearsAltered = distinctValues(lot.yearalter1, lot.yearalter2).filter((year) => Number(year) > 0);
  const lotArea = formattedNumber(lot.lotarea);
  const buildingArea = formattedNumber(lot.bldgarea);
  const stories = formattedNumber(lot.numfloors, 2);
  const facts = [
    sourcedFact({ key: "address", label: "Address", value: standardizedAddress(lot, searchMatch), retrievedAt, bbl }),
    sourcedFact({ key: "bbl", label: "BBL", value: bbl, retrievedAt, bbl }),
    sourcedFact({ key: "borough", label: "Borough", value: borough, retrievedAt, bbl }),
    sourcedFact({ key: "block", label: "Block", value: lot.block, retrievedAt, bbl }),
    sourcedFact({ key: "tax-lots", label: "Tax Lot(s)", value: lot.lot, retrievedAt, bbl }),
    sourcedFact({ key: "zip-code", label: "ZIP Code", value: lot.zipcode, retrievedAt, bbl }),
    sourcedFact({ key: "zoning-districts", label: "Zoning District(s)", value: zoningDistricts.join(", "), retrievedAt, bbl }),
    sourcedFact({ key: "commercial-overlays", label: "Commercial Overlay(s)", value: overlays.join(", ") || "None mapped", retrievedAt, bbl }),
    sourcedFact({ key: "special-purpose-district", label: "Special Purpose District(s)", value: specialDistrictValue(specialCodes, namesByCode) || "None mapped", retrievedAt, bbl }),
    sourcedFact({ key: "zoning-map", label: "Zoning Map", value: lot.zonemap, retrievedAt, bbl }),
    sourcedFact({ key: "community-district", label: "Community District", value: communityDistrict(lot), retrievedAt, bbl }),
    sourcedFact({ key: "tax-lot-area", label: "Tax Lot Area", value: lotArea ? `${lotArea} sq ft` : "", retrievedAt, bbl }),
    sourcedFact({ key: "lot-width", label: "Lot Width", value: formattedNumber(lot.lotfront, 2) ? `${formattedNumber(lot.lotfront, 2)} ft` : "", retrievedAt, bbl }),
    sourcedFact({ key: "lot-depth", label: "Lot Depth", value: formattedNumber(lot.lotdepth, 2) ? `${formattedNumber(lot.lotdepth, 2)} ft` : "", retrievedAt, bbl }),
    ...mapPLUTOAreaFacts(lot, { retrievedAt, bbl }),
    sourcedFact({ key: "building-area", label: "Building Area", value: buildingArea ? `${buildingArea} sq ft` : "", retrievedAt, bbl }),
    sourcedFact({ key: "stories-above-grade", label: "Stories Above Grade", value: stories, retrievedAt, bbl }),
    sourcedFact({ key: "building-count", label: "Number of Buildings", value: lot.numbldgs, retrievedAt, bbl }),
    sourcedFact({ key: "residential-units", label: "Residential Units", value: lot.unitsres, retrievedAt, bbl }),
    sourcedFact({ key: "total-units", label: "Total Units", value: lot.unitstotal, retrievedAt, bbl }),
    sourcedFact({ key: "year-built", label: "Year Built", value: Number(lot.yearbuilt) > 0 ? lot.yearbuilt : "", retrievedAt, bbl }),
    sourcedFact({ key: "years-altered", label: "Year(s) Altered", value: yearsAltered.join(", "), retrievedAt, bbl }),
    sourcedFact({ key: "building-class", label: "Building Class", value: lot.bldgclass, retrievedAt, bbl }),
    sourcedFact({ key: "land-use-code", label: "Land Use Code", value: lot.landuse, retrievedAt, bbl })
  ].filter(Boolean);
  return facts.map(fact => ({ ...fact, sourceText: lot.version ? fact.sourceText.replace("MapPLUTO;", `MapPLUTO ${lot.version};`) : fact.sourceText }));
}

export async function lookupNYCPropertyContext(address, { fetchImpl = fetch, now = () => new Date(), bbl: requestedBBL = "", includeLotGeometry = false } = {}) {
  const savedBBL = validBBL(requestedBBL);
  if (requestedBBL && !savedBBL) throw new NYCPropertyLookupError("Invalid saved BBL.", { status: 400 });
  const query = savedBBL ? String(address || "").trim() : normalizedNYCPropertyAddress(address);
  const searchURL = new URL(nycPlanningSearchURL);
  searchURL.searchParams.set("q", query);
  const searchPayload = savedBBL ? [{ type: "lot", bbl: savedBBL }] : await fetchJSON(searchURL, { fetchImpl });
  const borough = query.match(/\b(Bronx|Brooklyn|Manhattan|Queens|Staten Island)\b/i)?.[1];
  const matches = (Array.isArray(searchPayload) ? searchPayload : [])
    .filter(item => item?.type === "lot" && validBBL(item?.bbl) && (savedBBL ||
      (addressSearchKey(item.label) === addressSearchKey(query) &&
       (!borough || String(item.label).toLowerCase().includes(borough.toLowerCase())))));
  const distinctMatches = [...new Map(matches.map(item => [validBBL(item.bbl), item])).values()];
  const searchMatch = distinctMatches.length === 1 ? distinctMatches[0] : null;
  if (!searchMatch) {
    throw new NYCPropertyLookupError("No unambiguous New York City tax lot matched this address.", {
      code: "NYC_PROPERTY_NOT_FOUND",
      status: 404
    });
  }

  const bbl = validBBL(searchMatch.bbl);
  let lot = null;
  let usedOpenDataFallback = false;
  try {
    const lotPayload = await fetchJSON(cartoSQLURL(lotSQL.replace("__BBL__", bbl)), {
      fetchImpl,
      timeoutMilliseconds: cartoLookupTimeoutMilliseconds
    });
    lot = Array.isArray(lotPayload?.rows) ? lotPayload.rows[0] : null;
  } catch (error) {
    const openDataURL = new URL(nycOpenDataPLUTOURL);
    openDataURL.searchParams.set("$limit", "1");
    openDataURL.searchParams.set("bbl", bbl);
    const openDataPayload = await fetchJSON(openDataURL, { fetchImpl });
    lot = Array.isArray(openDataPayload) ? openDataPayload[0] : null;
    usedOpenDataFallback = true;
  }
  if (!lot) {
    throw new NYCPropertyLookupError("NYC Planning found the address but no current MapPLUTO record.", {
      code: "NYC_PROPERTY_DATA_NOT_FOUND",
      status: 404
    });
  }
  if (validBBL(lot.bbl) !== bbl) {
    throw new NYCPropertyLookupError("NYC Planning returned a different tax lot than the matched address.");
  }

  const specialDistrictCodes = distinctValues(lot.spdist1, lot.spdist2, lot.spdist3);
  let specialDistricts = [];
  // A name-service failure must not discard the property or its district codes.
  if (specialDistrictCodes.length) {
    const quotedCodes = specialDistrictCodes.map((code) => `'${code.replace(/'/g, "''")}'`).join(",");
    try {
      const specialPayload = await fetchJSON(cartoSQLURL(
        `SELECT DISTINCT sdname, sdlbl FROM dcp_special_purpose_districts WHERE sdlbl IN (${quotedCodes}) ORDER BY sdlbl`
      ), { fetchImpl, timeoutMilliseconds: cartoLookupTimeoutMilliseconds });
      specialDistricts = Array.isArray(specialPayload?.rows) ? specialPayload.rows : [];
    } catch { /* MapPLUTO district codes remain available. */ }
  }

  const retrievedAt = now().toISOString();
  const baseFacts = structuredFactsFromNYCPropertyData({
    lot,
    specialDistricts,
    searchMatch,
    retrievedAt
  });
  const mapped = await lookupMappedAreaFacts(bbl, retrievedAt, async sql => {
    const payload = await fetchJSON(cartoSQLURL(sql), { fetchImpl, timeoutMilliseconds: cartoLookupTimeoutMilliseconds });
    if (!Array.isArray(payload?.rows)) throw new NYCPropertyLookupError("Mapped layer response unavailable.");
    return payload.rows;
  });
  if (usedOpenDataFallback) {
    for (const fact of baseFacts) fact.sourceText = fact.sourceText.replace("MapPLUTO", "NYC Open Data PLUTO");
  }
  const factsByKey = new Map(baseFacts.map(fact => [fact.key, fact]));
  for (const fact of mapped.facts) {
    // Retain explicit MapPLUTO values when an independent layer is unavailable.
    if (fact.status !== "unknown" || !factsByKey.has(fact.key)) factsByKey.set(fact.key, fact);
  }
  const structuredFacts = [...factsByKey.values()];
  const normalizedAddress = structuredFacts.find((fact) => fact.key === "address")?.value || query;
  const lotTypes = { "1": "Block assemblage", "2": "Waterfront", "3": "Corner", "4": "Through",
    "5": "Inside", "6": "Interior lot", "7": "Island lot", "8": "Alley lot", "9": "Submerged land lot" };
  const lotTypeCode = String(lot.lottype ?? "").trim();
  const taxLot = {
    lotTypeCode: lotTypes[lotTypeCode] ? lotTypeCode : null,
    lotType: lotTypes[lotTypeCode] || "Unknown",
    dataVersion: String(lot.version || "").trim() || null,
    recordURL: `${nycOpenDataPLUTOURL}?bbl=${bbl}`,
    dictionaryURL: "https://s-media.nyc.gov/agencies/dcp/assets/files/pdf/data-tools/bytes/pluto_datadictionary.pdf",
    ...(includeLotGeometry ? { geometry: await lookupNYCTaxLotGeometry(bbl,
      url => fetchJSON(url, { fetchImpl, timeoutMilliseconds: 5_000 })) } : {})
  };
  return {
    schemaVersion: 2,
    query,
    normalizedAddress,
    bbl,
    zolaURL: `https://zola.planning.nyc.gov/l/lot/${Number(bbl.slice(0, 1))}/${Number(bbl.slice(1, 6))}/${Number(bbl.slice(6))}`,
    retrievedAt,
    source: {
      agency: "NYC Department of City Planning",
      datasets: usedOpenDataFallback
        ? ["NYC Planning address search", "NYC Open Data PLUTO", ...mapped.datasets]
        : ["NYC Planning address search", "MapPLUTO", ...mapped.datasets]
    },
    structuredFacts,
    taxLot,
    warnings: [
      ...(mapped.unavailable.length ? [`NYC Planning layers unavailable: ${mapped.unavailable.join(", ")}. Unverified facts remain unknown.`] : []),
      "Mapped intersections can cover part of a tax lot. Verify boundaries and project applicability in official records.",
      "Pending zoning map amendments are proposals under public review; they do not establish adopted zoning.",
      "The matched tax lot is not proof of zoning-lot composition.",
      "Mapped data can change. Confirm governing requirements in current official zoning text and records."
    ]
  };
}
