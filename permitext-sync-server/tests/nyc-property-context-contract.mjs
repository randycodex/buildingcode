import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  lookupNYCPropertyContext,
  normalizedNYCPropertyAddress,
  NYCPropertyLookupError
} from "../nyc-property-context.mjs";

const retrievedAt = "2026-08-24T12:00:00.000Z";
const fetchCalls = [];
const fetchImpl = async (input) => {
  const url = new URL(String(input));
  fetchCalls.push(url);
  if (url.hostname === "search-api-production.herokuapp.com") {
    return {
      ok: true,
      json: async () => [{
        label: "1760 JEROME AVENUE, Bronx, NY, USA",
        bbl: "2028500003",
        type: "lot"
      }]
    };
  }
  const sql = url.searchParams.get("q") || "";
  if (sql.includes("FROM dcp_mappluto")) {
    return {
      ok: true,
      json: async () => ({ rows: [{
        address: "1760 JEROME AVENUE",
        bbl: 2028500003,
        borough: "BX",
        borocode: 2,
        block: 2850,
        lot: 3,
        zipcode: 10453,
        cd: 205,
        lotarea: 14000,
        lotfront: 140,
        lotdepth: 100,
        bldgarea: 121016,
        numbldgs: 1,
        numfloors: 14,
        unitsres: 175,
        unitstotal: 175,
        yearbuilt: 2025,
        yearalter1: 2024,
        yearalter2: 2025,
        bldgclass: "D1",
        landuse: "03",
        overlay1: "C2-4",
        overlay2: null,
        spdist1: "J",
        spdist2: null,
        spdist3: null,
        zonedist1: "R8A",
        zonedist2: null,
        zonedist3: null,
        zonedist4: null,
        zonemap: "3d",
        inclusionary_housing: false,
        mandatory_inclusionary_housing: true,
        appendix_i_transit_zone: true,
        waterfront_access_plan: false,
        upland_waterfront_area: false,
        lower_density_growth_management_area: false,
        fresh_zone: true,
        appendix_j_designated_mdistrict: false
      }] })
    };
  }
  if (sql.includes("FROM dcp_special_purpose_districts")) {
    return {
      ok: true,
      json: async () => ({ rows: [{ sdlbl: "J", sdname: "Special Jerome Corridor District" }] })
    };
  }
  throw new Error(`Unexpected request: ${url}`);
};

assert.equal(normalizedNYCPropertyAddress("  1760\nJerome Avenue  "), "1760 Jerome Avenue");
assert.throws(
  () => normalizedNYCPropertyAddress(""),
  (error) => error instanceof NYCPropertyLookupError && error.code === "NYC_PROPERTY_ADDRESS_REQUIRED"
);

const result = await lookupNYCPropertyContext("1760 Jerome Avenue, Bronx", {
  fetchImpl,
  now: () => new Date(retrievedAt)
});
assert.equal(result.bbl, "2028500003");
assert.equal(result.normalizedAddress, "1760 JEROME AVENUE, Bronx, NY 10453");
assert.equal(result.zolaURL, "https://zola.planninglabs.nyc/l/lot/2/2850/3");
assert.equal(result.structuredFacts.length, 30);
assert.ok(result.structuredFacts.every((fact) => fact.status === "sourced"));
assert.ok(result.structuredFacts.every((fact) => fact.source === "nyc-planning"));
assert.equal(result.structuredFacts.find((fact) => fact.key === "zoning-districts")?.value, "R8A");
assert.equal(result.structuredFacts.find((fact) => fact.key === "special-purpose-district")?.value,
  "J — Special Jerome Corridor District");
assert.equal(result.structuredFacts.find((fact) => fact.key === "tax-lot-area")?.value, "14,000 sq ft");
assert.equal(result.structuredFacts.some((fact) => fact.key === "zoning-lot-area"), false,
  "MapPLUTO tax-lot area must not be presented as legal zoning-lot area");
assert.match(result.structuredFacts.find((fact) => fact.key === "mih-area-options")?.value || "", /Mandatory Inclusionary Housing/);
assert.match(result.warnings.join(" "), /tax lot is not proof of zoning-lot composition/i);
assert.equal(fetchCalls.length, 3);
assert.match(fetchCalls[1].searchParams.get("q") || "", /p\.bbl = '2028500003'/);

const [serverSource, clientSource] = await Promise.all([
  readFile(new URL("../app.mjs", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8")
]);
assert.match(serverSource, /"projects\/property\/lookup": handleProjectPropertyLookup/);
assert.match(serverSource, /status === "sourced"/);
assert.match(clientSource, /postResearch\("\/projects\/property\/lookup", \{ address \}\)/);
assert.match(clientSource, /structuredFacts: property\?\.structuredFacts \|\| \[\]/);
assert.match(clientSource, /Imported \$\{property\.structuredFacts\.length\} sourced facts from NYC Planning/);

console.log("nyc-property-context contract passed");
