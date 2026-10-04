import assert from "node:assert/strict";
import { lookupNYCPropertyContext } from "../nyc-property-context.mjs";
import { lookupMappedAreaFacts } from "../nyc-property-layers.mjs";
import { nycMappedFactFields, mergeNYCPropertyFacts } from "../public/nyc-property-facts.js";
import { projectFactProjection } from "../project-fact-projection.mjs";

const retrievedAt = "2026-10-04T12:00:00.000Z";
let active = 0, maximumActive = 0;
const queries = [];
const mapped = await lookupMappedAreaFacts("2028500003", retrievedAt, async sql => {
  queries.push(sql);
  active++;
  maximumActive = Math.max(maximumActive, active);
  await new Promise(resolve => setImmediate(resolve));
  active--;
  if (sql.includes("FROM dcp_coastal_zone_boundary layer")) throw new Error("Service unavailable");
  if (sql.includes("FROM mta_nyc_rail_station_buffer_dissolve layer")) return [];
  if (sql.includes("FROM floodplain_pfirm2015 layer")) return [{ records: null }];
  let records = [];
  if (sql.includes("FROM dcp_transit_zones layer")) records = [
    { transtzone: "Outer Transit Zone", covers_lot: false },
    { transtzone: "Special 25-241 Parking Provisions", covers_lot: false }
  ];
  if (sql.includes("layer.status = 'Certified'")) records = [{ ulurpno: "260001ZMX", project_na: "Synthetic proposal", status: "Certified", covers_lot: true }];
  if (sql.includes("FROM dcp_limited_height_districts layer")) records = [{ lhlbl: "LH-1", lhname: "Synthetic height district", covers_lot: true }];
  if (sql.includes("FROM dcp_waterfront_access_plan layer")) records = [{ name: "Upland waterfront area", covers_lot: true }];
  if (sql.includes("FROM dcp_e_designations layer")) records = [{ enumber: "E-123", descriptio: "Noise", ceqr_num: "24DCP001X", ulurp_num: "260001ZMX", covers_lot: true }];
  return [{ records }];
});
const byKey = new Map(mapped.facts.map(fact => [fact.key, fact]));
assert.equal(mapped.facts.length, nycMappedFactFields.length);
assert.ok(maximumActive <= 6, "Remote concurrency must be bounded");
assert.match(byKey.get("parking-geography").value, /Outer Transit Zone.*Special 25-241.*partial tax-lot/);
assert.equal(byKey.get("appendix-i-transit-zone").value, "No mapped intersection found");
assert.equal(byKey.get("coastal-zone").status, "unknown", "Network failure cannot become a negative mapping fact");
assert.equal(byKey.get("zoning-for-accessibility").status, "unknown", "Missing lot geometry cannot become a negative mapping fact");
assert.equal(byKey.get("flood-zone-preliminary-2015").status, "unknown", "Malformed data cannot become a negative mapping fact");
assert.equal(byKey.get("flood-zone-effective-2007").status, "sourced");
assert.match(byKey.get("flood-zone-effective-2007").value, /No mapped 1% annual-chance/);
assert.match(byKey.get("limited-height-district").value, /LH-1/);
assert.equal(byKey.get("waterfront-status").value, "Upland waterfront area");
assert.match(byKey.get("environmental-designations").value, /E-123.*Noise.*CEQR.*ULURP/);
assert.ok(queries.every(sql => sql.includes("NOT ST_IsEmpty(the_geom)")));
assert.ok(queries.filter(sql => !sql.includes("layer.bbl =")).every(sql => sql.includes("'2********'")), "A touching boundary must not count as an area intersection");
assert.match(queries.find(sql => sql.includes("FROM dcp_e_designations layer")), /layer\.bbl = '2028500003'/);
assert.match(queries.find(sql => sql.includes("layer.status = 'Certified'")), /ulurpno, project_na, status,/);
assert.doesNotMatch(queries.find(sql => sql.includes("layer.status = 'Certified'")), /SELECT ulurpno, project_na, status, effective/);
assert.ok(!mapped.datasets.includes("dcp_coastal_zone_boundary"));
assert.equal(mapped.unavailable.length, 3);

const crowded = await lookupMappedAreaFacts("2028500003", retrievedAt, async () => [{ records: Array.from({ length: 26 }, (_, index) => ({ projectnam: `Area ${index} ${"x".repeat(70)}`, mih_option: "Option 1", covers_lot: true })) }]);
assert.ok(crowded.facts.every(fact => fact.value.length <= 1000));
assert.match(crowded.facts.find(fact => fact.key === "mih-area-options").value, /Additional details require ZoLa review/);
for (const records of [[null], ["invalid"], [{}], [{ covers_lot: null }]]) {
  const malformed = await lookupMappedAreaFacts("2028500003", retrievedAt, async () => [{ records }]);
  assert.ok(malformed.facts.every(fact => fact.status === "unknown"), "Malformed records must remain unknown without breaking other property data");
}

const existing = [
  { key: "parking-geography", value: "Manually checked Inner Transit Zone", source: "user", status: "confirmed" },
  { key: "coastal-zone", value: "Within mapped Coastal Zone", source: "nyc-planning", status: "sourced" },
  { key: "retired-field", value: "Old source", source: "nyc-planning", status: "sourced" },
  { key: "landmark-status", value: "Rejected mapped landmark", source: "nyc-planning", status: "rejected" },
  { key: "occupancy", value: "Group R-2", source: "user", status: "confirmed" },
  { key: "transit-zone", value: "Within Appendix I", source: "nyc-planning", status: "sourced" }
];
const before = structuredClone(existing);
const refreshed = mergeNYCPropertyFacts(existing, mapped.facts, retrievedAt);
assert.deepEqual(existing, before, "Refresh cannot mutate the original record");
assert.equal(refreshed.find(fact => fact.key === "parking-geography").value, existing[0].value);
assert.equal(refreshed.find(fact => fact.key === "coastal-zone").status, "unknown");
assert.equal(refreshed.find(fact => fact.key === "retired-field").status, "unknown");
assert.equal(refreshed.find(fact => fact.key === "landmark-status").status, "rejected");
assert.equal(refreshed.find(fact => fact.key === "occupancy").value, "Group R-2");
assert.equal(refreshed.some(fact => fact.key === "transit-zone"), false);
assert.equal(new Set(refreshed.map(fact => fact.key)).size, refreshed.length);
const projection = projectFactProjection({ structuredFacts: refreshed });
assert.ok(projection.zoningFacts.some(fact => fact.key === "pending-zoning-map-amendments"));
assert.ok(!projection.usableFacts.some(fact => fact.key === "coastal-zone"));
assert.ok(projection.researchFacts.some(line => line.startsWith("Unknown:") && line.includes("Coastal Zone")));
assert.ok(projection.researchFacts.some(line => line.includes("Pending Zoning Map Amendments") && line.includes("does not establish adopted zoning")));
assert.ok(projection.reportFacts.includes("does not establish adopted zoning"));

// PLUTO fallback still attempts independent mapped layers. Failed district-name
// enrichment must not make a valid property lookup fail.
const recovered = await lookupNYCPropertyContext("1760 Jerome Avenue", {
  now: () => new Date(retrievedAt),
  fetchImpl: async input => {
    const url = new URL(input);
    if (url.hostname === "search-api-production.herokuapp.com") return { ok: true, json: async () => [{ bbl: "2028500003", type: "lot" }] };
    if (url.hostname === "data.cityofnewyork.us") return { ok: true, json: async () => [{ bbl: "2028500003", address: "1760 JEROME AVENUE", borocode: 2, spdist1: "J", trnstzone: "Outer Transit Zone" }] };
    const sql = url.searchParams.get("q");
    if (!sql.startsWith("WITH lot AS")) throw new Error("Base/name service unavailable");
    return { ok: true, json: async () => ({ rows: [{ records: [] }] }) };
  }
});
assert.equal(recovered.structuredFacts.find(fact => fact.key === "special-purpose-district").value, "J");
assert.equal(recovered.structuredFacts.find(fact => fact.key === "mih-area-options").status, "sourced");
assert.ok(recovered.source.datasets.includes("NYC Open Data PLUTO"));
assert.ok(recovered.source.datasets.includes("dcp_mandatory_inclusionary_housing"));
console.log("ZoLa independent layers, unknowns, boundaries, proposals, fallback and safe refresh passed.");
