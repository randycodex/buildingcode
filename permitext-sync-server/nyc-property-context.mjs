const nycPlanningSearchURL = "https://search-api-production.herokuapp.com/search/geosearch-v2";
const nycPlanningCartoSQLURL = "https://carto.nycplanningdigital.com/api/v2/sql";
const lookupTimeoutMilliseconds = 12_000;

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
  EXISTS(
    SELECT 1 FROM dcp_inclusionary_housing layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS inclusionary_housing,
  EXISTS(
    SELECT 1 FROM dcp_mandatory_inclusionary_housing layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS mandatory_inclusionary_housing,
  EXISTS(
    SELECT 1 FROM dcp_appendixi_transit_zones layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS appendix_i_transit_zone,
  EXISTS(
    SELECT 1 FROM dcp_waterfront_access_plan layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS waterfront_access_plan,
  EXISTS(
    SELECT 1 FROM upland_waterfront_areas layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS upland_waterfront_area,
  EXISTS(
    SELECT 1 FROM dcp_lower_density_growth_management_areas layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS lower_density_growth_management_area,
  EXISTS(
    SELECT 1 FROM dcp_fresh_zones layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS fresh_zone,
  EXISTS(
    SELECT 1 FROM dcp_appendixj_designated_mdistricts layer
    WHERE ST_Intersects(p.the_geom, layer.the_geom)
  ) AS appendix_j_designated_mdistrict
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

function booleanValue(value) {
  return value === true || value === "true" || value === 1 || value === "1";
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
    sourcedFact({ key: "special-purpose-district", label: "Special Purpose District / Subdistrict / Subarea", value: specialDistrictValue(specialCodes, namesByCode) || "None mapped", retrievedAt, bbl }),
    sourcedFact({ key: "zoning-map", label: "Zoning Map", value: lot.zonemap, retrievedAt, bbl }),
    sourcedFact({ key: "community-district", label: "Community District", value: communityDistrict(lot), retrievedAt, bbl }),
    sourcedFact({ key: "tax-lot-area", label: "Tax Lot Area", value: lotArea ? `${lotArea} sq ft` : "", retrievedAt, bbl }),
    sourcedFact({ key: "lot-width", label: "Lot Width", value: formattedNumber(lot.lotfront, 2) ? `${formattedNumber(lot.lotfront, 2)} ft` : "", retrievedAt, bbl }),
    sourcedFact({ key: "lot-depth", label: "Lot Depth", value: formattedNumber(lot.lotdepth, 2) ? `${formattedNumber(lot.lotdepth, 2)} ft` : "", retrievedAt, bbl }),
    sourcedFact({ key: "mih-area-options", label: "MIH Area / Applicable Option(s)", value: booleanValue(lot.mandatory_inclusionary_housing) ? "Within a mapped Mandatory Inclusionary Housing area; applicable options require zoning-text review" : "Not within a mapped Mandatory Inclusionary Housing area", retrievedAt, bbl, dataset: "mapped zoning layers" }),
    sourcedFact({ key: "affordable-housing-zoning-status", label: "Affordable Housing Zoning Status", value: booleanValue(lot.inclusionary_housing) ? "Within a mapped Inclusionary Housing designated area" : "Not within a mapped Inclusionary Housing designated area", retrievedAt, bbl, dataset: "mapped zoning layers" }),
    sourcedFact({ key: "transit-zone", label: "Transit Zone", value: booleanValue(lot.appendix_i_transit_zone) ? "Within a mapped Appendix I transit zone" : "Not within a mapped Appendix I transit zone", retrievedAt, bbl, dataset: "mapped zoning layers" }),
    sourcedFact({ key: "waterfront-status", label: "Waterfront Status / Waterfront Access Plan", value: booleanValue(lot.waterfront_access_plan) || booleanValue(lot.upland_waterfront_area) ? "Within a mapped waterfront area or Waterfront Access Plan" : "Not within a mapped waterfront area or Waterfront Access Plan", retrievedAt, bbl, dataset: "mapped zoning layers" }),
    sourcedFact({ key: "lower-density-growth-management-area", label: "Lower Density Growth Management Area", value: booleanValue(lot.lower_density_growth_management_area) ? "Within a mapped lower-density growth management area" : "Not within a mapped lower-density growth management area", retrievedAt, bbl, dataset: "mapped zoning layers" }),
    sourcedFact({ key: "fresh-program-area", label: "FRESH Program Area", value: booleanValue(lot.fresh_zone) ? "Within a mapped FRESH program area" : "Not within a mapped FRESH program area", retrievedAt, bbl, dataset: "mapped zoning layers" }),
    sourcedFact({ key: "appendix-j-designated-m-district", label: "Appendix J Designated M District", value: booleanValue(lot.appendix_j_designated_mdistrict) ? "Within a mapped Appendix J designated M district" : "Not within a mapped Appendix J designated M district", retrievedAt, bbl, dataset: "mapped zoning layers" }),
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
  return facts;
}

export async function lookupNYCPropertyContext(address, { fetchImpl = fetch, now = () => new Date() } = {}) {
  const query = normalizedNYCPropertyAddress(address);
  const searchURL = new URL(nycPlanningSearchURL);
  searchURL.searchParams.set("q", query);
  const searchPayload = await fetchJSON(searchURL, { fetchImpl });
  const searchMatch = (Array.isArray(searchPayload) ? searchPayload : [])
    .find((item) => item?.type === "lot" && validBBL(item?.bbl));
  if (!searchMatch) {
    throw new NYCPropertyLookupError("No New York City tax lot matched this address.", {
      code: "NYC_PROPERTY_NOT_FOUND",
      status: 404
    });
  }

  const bbl = validBBL(searchMatch.bbl);
  const lotPayload = await fetchJSON(cartoSQLURL(lotSQL.replace("__BBL__", bbl)), { fetchImpl });
  const lot = Array.isArray(lotPayload?.rows) ? lotPayload.rows[0] : null;
  if (!lot) {
    throw new NYCPropertyLookupError("NYC Planning found the address but no current MapPLUTO record.", {
      code: "NYC_PROPERTY_DATA_NOT_FOUND",
      status: 404
    });
  }

  const specialDistrictCodes = distinctValues(lot.spdist1, lot.spdist2, lot.spdist3);
  let specialDistricts = [];
  if (specialDistrictCodes.length) {
    const quotedCodes = specialDistrictCodes.map((code) => `'${code.replace(/'/g, "''")}'`).join(",");
    const specialPayload = await fetchJSON(cartoSQLURL(
      `SELECT DISTINCT sdname, sdlbl FROM dcp_special_purpose_districts WHERE sdlbl IN (${quotedCodes}) ORDER BY sdlbl`
    ), { fetchImpl });
    specialDistricts = Array.isArray(specialPayload?.rows) ? specialPayload.rows : [];
  }

  const retrievedAt = now().toISOString();
  const structuredFacts = structuredFactsFromNYCPropertyData({
    lot,
    specialDistricts,
    searchMatch,
    retrievedAt
  });
  const normalizedAddress = structuredFacts.find((fact) => fact.key === "address")?.value || query;
  return {
    schemaVersion: 1,
    query,
    normalizedAddress,
    bbl,
    zolaURL: `https://zola.planninglabs.nyc/l/lot/${Number(bbl.slice(0, 1))}/${Number(bbl.slice(1, 6))}/${Number(bbl.slice(6))}`,
    retrievedAt,
    source: {
      agency: "NYC Department of City Planning",
      datasets: ["NYC Planning address search", "MapPLUTO", "mapped zoning layers"]
    },
    structuredFacts,
    warnings: [
      "The matched tax lot is not proof of zoning-lot composition.",
      "Mapped data can change. Confirm governing requirements in current official zoning text and records."
    ]
  };
}
