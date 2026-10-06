// DOF's Digital Tax Map identifies lot faces that also form a block boundary.
// Keep this mapped evidence separate from a surveyed zoning lot or legal street.
export const taxLotPolygonURL = "https://data.cityofnewyork.us/resource/i38t-6if2.json";
export const taxLotFacesURL = "https://data.cityofnewyork.us/resource/sif6-3bej.json";

function point(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) &&
    value[0] >= -74.3 && value[0] <= -73.6 && value[1] >= 40.4 && value[1] <= 41;
}

function near(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.0000001;
}

function projected(p, origin) {
  return [(p[0] - origin[0]) * Math.cos(origin[1] * Math.PI / 180), p[1] - origin[1]];
}

function intersect(a, b, c, d) {
  const turn = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) &&
    turn(a, b, c) * turn(a, b, d) <= 0 && turn(c, d, a) * turn(c, d, b) <= 0;
}

function straightFace(record, bbl) {
  if (record?.bbl !== bbl || !["0", "1"].includes(String(record.block_face_flag)) ||
      String(record.tax_lot_face_type) !== "0" || Number(record.radius || 0) !== 0 ||
      Number(record.arclength || 0) !== 0 || String(record.lot_face_length_error) !== "0" ||
      String(record.approx_length_flag) !== "0") return null;
  const geometry = record.the_geom;
  const line = geometry?.type === "MultiLineString" && geometry.coordinates?.length === 1
    ? geometry.coordinates[0] : geometry?.type === "LineString" ? geometry.coordinates : null;
  // Curved or multipart faces require the original map/survey, not a chord.
  if (!line || line.length !== 2 || !line.every(point) || near(line[0], line[1])) return null;
  return { line, blockBoundary: String(record.block_face_flag) === "1",
    recordedLengthFeet: Number(record.lot_face_length) > 0 ? Number(record.lot_face_length) : null };
}

export function taxLotGeometryEvidence(bbl, polygons, faceRecords) {
  const unknown = { status: "unresolved", limitation: "The official tax-map geometry did not establish straight intersecting block-boundary lot faces; do not infer an intersection angle or a zoning-lot classification." };
  if (!Array.isArray(polygons) || polygons.length !== 1 || polygons[0]?.bbl !== bbl ||
      !Array.isArray(faceRecords) || faceRecords.length < 3 || faceRecords.length >= 100) return unknown;
  const shape = polygons[0].the_geom;
  const polygon = shape?.type === "MultiPolygon" && shape.coordinates?.length === 1
    ? shape.coordinates[0] : shape?.type === "Polygon" ? shape.coordinates : null;
  if (!polygon || polygon.length !== 1) return unknown;
  const ring = polygon[0];
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 100 || !ring.every(point) ||
      !near(ring[0], ring.at(-1))) return unknown;
  const vertices = ring.slice(0, -1);
  if (vertices.some((p, index) => vertices.slice(index + 1).some(other => near(p, other)))) return unknown;
  const projectedRing = vertices.map(p => projected(p, vertices[0]));
  for (let a = 0; a < vertices.length; a++) {
    for (let b = a + 2; b < vertices.length; b++) {
      if (a === 0 && b === vertices.length - 1) continue;
      if (intersect(projectedRing[a], projectedRing[(a + 1) % vertices.length],
        projectedRing[b], projectedRing[(b + 1) % vertices.length])) return unknown;
    }
  }
  const area = projectedRing.reduce((sum, p, index) => {
    const next = projectedRing[(index + 1) % vertices.length];
    return sum + p[0] * next[1] - next[0] * p[1];
  }, 0);
  if (!Number.isFinite(area) || Math.abs(area) < 1e-12) return unknown;
  const faces = faceRecords.map(record => straightFace(record, bbl)).filter(Boolean);
  const edges = vertices.map((p, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const matches = faces.filter(face => (near(face.line[0], p) && near(face.line[1], next)) ||
      (near(face.line[1], p) && near(face.line[0], next)));
    return matches.length === 1 ? matches[0] : null;
  });
  const intersections = vertices.flatMap((p, index) => {
    const previousIndex = (index + vertices.length - 1) % vertices.length;
    const a = edges[previousIndex], b = edges[index];
    if (!a?.blockBoundary || !b?.blockBoundary) return [];
    const u = projected(vertices[previousIndex], p);
    const v = projected(vertices[(index + 1) % vertices.length], p);
    const divisor = Math.hypot(...u) * Math.hypot(...v);
    if (!divisor) return [];
    let angle = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / divisor))) * 180 / Math.PI;
    if ((u[0] * v[1] - u[1] * v[0]) * area > 0) angle = 360 - angle;
    // A split in a straight face is not an intersecting-street corner.
    if (Math.abs(angle - 180) < 1) return [];
    return [{ approximateInteriorAngleDegrees: Math.round(angle * 10) / 10,
      coordinate: p, recordedFaceLengthsFeet: [a.recordedLengthFeet, b.recordedLengthFeet] }];
  });
  if (!intersections.length) return unknown;
  return { status: "retrieved", intersections,
    limitation: "Computed from straight DOF tax-lot faces flagged as block boundaries. These are mapped tax-lot measurements, not surveyed legal street lines or proof of zoning-lot composition. Curved and uncertain faces are excluded." };
}

export async function lookupNYCTaxLotGeometry(bbl, fetchJSON) {
  if (!/^[1-5]\d{9}$/.test(bbl)) throw new Error("Invalid tax-lot identifier");
  const urls = [taxLotPolygonURL, taxLotFacesURL].map(base => {
    const url = new URL(base);
    url.searchParams.set("bbl", bbl);
    url.searchParams.set("$limit", "100");
    return url;
  });
  const results = await Promise.allSettled(urls.map(async url => {
    try { return await fetchJSON(url); }
    catch { return await fetchJSON(url); } // One bounded retry of a public read.
  }));
  const evidence = taxLotGeometryEvidence(bbl,
    results[0].status === "fulfilled" ? results[0].value : null,
    results[1].status === "fulfilled" ? results[1].value : null);
  return { ...evidence, sources: urls.map(String) };
}
