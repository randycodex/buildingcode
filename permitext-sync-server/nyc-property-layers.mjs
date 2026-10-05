import { nycMappedFactFields } from "./public/nyc-property-facts.js";

const names = (...values) => [...new Set(values.flat().map(value => String(value ?? "").trim()).filter(Boolean))];
const join = (...values) => names(...values).join(" — ");
const date = value => /^\d{4}-\d{2}-\d{2}/.test(String(value ?? "")) ? String(value).slice(0, 10) : "";
const membership = title => () => `Mapped ${title} intersection`;
const amendment = row => join(row.ulurpno, row.project_na, row.status,
  date(row.effective) && `effective ${date(row.effective)}`);

// Table and column names verified against NYC Planning's ZoLa layer definitions
// and public CARTO schemas. Each layer fails independently of the base property.
const layers = [
  ["special-purpose-subdistrict", "dcp_special_purpose_subdistricts", "splbl, spname, subdist, sub_area_n, subarea_lb", row => join(row.splbl, row.spname, row.subdist, row.sub_area_n, row.subarea_lb)],
  ["mih-area-options", "dcp_mandatory_inclusionary_housing", "projectnam, mih_option, zr_ulurpno, dateadopte, zr_map", row => join(row.projectnam, row.mih_option ? `mapped MIH options: ${row.mih_option}` : "MIH options require Appendix F review", row.zr_ulurpno, date(row.dateadopte), row.zr_map)],
  ["affordable-housing-zoning-status", "dcp_inclusionary_housing", "projectnam", row => join("Inclusionary Housing designated area", row.projectnam)],
  ["greater-transit-zone", "dcp_greater_transit_zone", "gtz_qs", membership("Greater Transit Zone")],
  ["parking-geography", "dcp_transit_zones", "transtzone", row => row.transtzone],
  ["appendix-i-transit-zone", "dcp_appendixi_transit_zones", "TRUE AS present", membership("Appendix I transit zone")],
  ["zoning-for-accessibility", "mta_nyc_rail_station_buffer_dissolve", "TRUE AS present", membership("50-foot transit station-adjacent area")],
  ["limited-height-district", "dcp_limited_height_districts", "lhlbl, lhname", row => join(row.lhlbl, row.lhname)],
  ["landmark-status", "lpc_individual_and_interior_landmarks", "lp_number, lm_name, lm_type", row => join(row.lp_number, row.lm_name, row.lm_type), "layer.last_actio = 'DESIGNATED' AND layer.lm_type IN ('Individual Landmark', 'Interior Landmark')", "bbl"],
  ["historic-district", "lpc_historic_districts", "lp_number, area_name", row => join(row.lp_number, row.area_name), "layer.status_of_ = 'DESIGNATED'"],
  ["flood-zone-effective-2007", "floodplain_firm2007", "fld_zone", row => `Mapped 1% annual-chance flood zone: ${row.fld_zone}`, "layer.fld_zone IN ('A', 'AO', 'A0', 'AE', 'VE')"],
  ["flood-zone-preliminary-2015", "floodplain_pfirm2015", "fld_zone", row => `Preliminary mapped 1% annual-chance flood zone: ${row.fld_zone}`, "layer.fld_zone IN ('A', 'AO', 'A0', 'AE', 'VE')"],
  ["environmental-designations", "dcp_e_designations", "enumber, ceqr_num, ulurp_num, descriptio", row => join(row.enumber, row.descriptio, row.ceqr_num && `CEQR ${row.ceqr_num}`, row.ulurp_num && `ULURP ${row.ulurp_num}`), "TRUE", "bbl"],
  ["coastal-zone", "dcp_coastal_zone_boundary", "TRUE AS present", membership("Coastal Zone")],
  ["waterfront-status", "dcp_waterfront_access_plan", "name", row => row.name === "Upland waterfront area" ? row.name : join("Waterfront Access Plan", row.name)],
  ["lower-density-growth-management-area", "dcp_lower_density_growth_management_areas", "TRUE AS present", membership("lower-density growth management area")],
  ["fresh-program-area", "dcp_fresh_zones", "name", row => join("FRESH program area", row.name)],
  ["appendix-j-designated-m-district", "dcp_appendixj_designated_mdistricts", "name, subarea", row => join("Appendix J designated M district", row.name, row.subarea)],
  ["adopted-zoning-map-amendments", "dcp_zoning_map_amendments", "ulurpno, project_na, status, effective", amendment, "layer.status = 'Adopted'"],
  ["pending-zoning-map-amendments", "dcp_zoning_map_amendments", "ulurpno, project_na, status", row => join(row.ulurpno, row.project_na, row.status, "pending proposal; does not establish adopted zoning"), "layer.status = 'Certified'"]
].map(([key, table, columns, format, filter = "TRUE", match = "polygon"]) => ({ key, table, columns, format, filter, match }));

export function mappedLayerSQL(layer, bbl) {
  if (!/^\d{10}$/.test(bbl)) throw new Error("Invalid tax-lot identifier");
  const relation = layer.match === "bbl"
    ? `layer.bbl = '${bbl}'`
    : "ST_Intersects(lot.the_geom, layer.the_geom) AND ST_Relate(lot.the_geom, layer.the_geom, '2********')";
  const coverage = layer.match === "polygon" ? "ST_Covers(layer.the_geom, lot.the_geom)" : "TRUE";
  let matches = `SELECT ${layer.columns}, ${coverage} AS covers_lot FROM ${layer.table} layer WHERE ${relation} AND (${layer.filter})`;
  // Preserve ZoLa's combined waterfront result, while naming its two sources.
  if (layer.key === "waterfront-status") matches += ` UNION ALL SELECT 'Upland waterfront area' AS name, ST_Covers(layer.the_geom, lot.the_geom) AS covers_lot FROM upland_waterfront_areas layer WHERE ST_Intersects(lot.the_geom, layer.the_geom) AND ST_Relate(lot.the_geom, layer.the_geom, '2********')`;
  // Scenic landmarks have polygons; individual/interior records match by BBL.
  if (layer.key === "landmark-status") matches += ` UNION ALL SELECT lp_number, scen_lm_na AS lm_name, 'Scenic Landmark' AS lm_type, ST_Covers(layer.the_geom, lot.the_geom) AS covers_lot FROM lpc_scenic_landmarks layer WHERE layer.last_actio = 'DESIGNATED' AND ST_Intersects(lot.the_geom, layer.the_geom) AND ST_Relate(lot.the_geom, layer.the_geom, '2********')`;
  return `WITH lot AS (SELECT the_geom FROM dcp_mappluto WHERE bbl = '${bbl}' AND the_geom IS NOT NULL AND NOT ST_IsEmpty(the_geom))
    SELECT COALESCE((SELECT json_agg(matches) FROM (SELECT * FROM (${matches}) records ORDER BY row_to_json(records)::text LIMIT 26) matches), '[]'::json) AS records FROM lot`;
}

export async function lookupMappedAreaFacts(bbl, retrievedAt, fetchRows) {
  const results = new Array(layers.length);
  let cursor = 0;
  // Bounded concurrency and per-request timeouts keep failures from holding up
  // every other layer or exhausting the remote service's connections.
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < layers.length) {
      const index = cursor++;
      const layer = layers[index];
      try {
        const rows = await fetchRows(mappedLayerSQL(layer, bbl));
        if (rows.length !== 1 || !Array.isArray(rows[0]?.records)) throw new Error("Layer coverage unavailable");
        if (!rows[0].records.every(record => record && typeof record === "object" &&
            !Array.isArray(record) && typeof record.covers_lot === "boolean")) throw new Error("Layer records unavailable");
        results[index] = { layer, records: rows[0].records };
      } catch { results[index] = { layer, records: null }; }
    }
  }));
  const unavailable = [];
  const datasets = new Set();
  const facts = results.map(({ layer, records }) => {
    const { key, label } = nycMappedFactFields.find(field => field.key === layer.key);
    if (records === null) unavailable.push(label);
    else datasets.add(layer.table);
    if (records !== null && key === "waterfront-status") datasets.add("upland_waterfront_areas");
    if (records !== null && key === "landmark-status") datasets.add("lpc_scenic_landmarks");
    const details = records === null ? [] : names(records.slice(0, 25).map(layer.format));
    const partial = records?.some(row => row.covers_lot === false);
    const empty = key.startsWith("flood-zone-") ? "No mapped 1% annual-chance flood-zone intersection" : "No mapped intersection found";
    const qualifiers = [partial && "Includes partial tax-lot intersections; verify boundaries",
      key === "mih-area-options" && records?.length && "Verify applicable options in Appendix F",
      records?.length > 25 && "Additional matches require ZoLa review"].filter(Boolean);
    let value = records === null ? "Unknown — NYC Planning layer unavailable" : [details.join("; ") || (records.length ? "Mapped intersection; details require ZoLa review" : empty), ...qualifiers].join(". ");
    // Research and sync cap values at 1,000 characters. Make truncation explicit.
    if (value.length > 950) value = value.slice(0, 880) + "… Additional details require ZoLa review.";
    return { id: `project-fact:${key}`, key, label, value,
      status: records === null ? "unknown" : "sourced", source: "nyc-planning",
      sourceText: `NYC Planning ZoLa ${layer.table}; BBL ${bbl}; retrieved ${retrievedAt.slice(0, 10)}.`, updatedAt: retrievedAt };
  });
  return { facts, unavailable, datasets: [...datasets] };
}
