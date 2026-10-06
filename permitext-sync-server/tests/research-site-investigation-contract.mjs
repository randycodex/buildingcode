import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { researchPropertyContext, researchPropertyContextFacts, researchPropertyInvestigationInstruction } from "../research-property-context.mjs";
import { lookupNYCPropertyContext } from "../nyc-property-context.mjs";
import { lookupNYCTaxLotGeometry, taxLotGeometryEvidence } from "../nyc-tax-lot-geometry.mjs";
import { targetedDefinitionExcerpt } from "../research-definition-excerpts.mjs";
import { zoningSection } from "../zoning-content.mjs";
import { createResearchCorpusRegistry, routeResearchCorpora } from "../research-corpus-registry.mjs";
import { planZoningResearchQuestion } from "../research-zoning-planner.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/research-corner-tax-lot.json", import.meta.url)));
const bbl = fixture.provenance.bbl;
const geometry = taxLotGeometryEvidence(bbl, fixture.polygons, fixture.faces);
assert.equal(geometry.status, "retrieved");
assert.equal(geometry.intersections.length, 1);
assert.equal(geometry.intersections[0].approximateInteriorAngleDegrees, 90);
assert.deepEqual(geometry.intersections[0].recordedFaceLengthsFeet, [120, 47]);

function syntheticGeometry(vertices, boundaryIndices) {
  const ring = [...vertices, vertices[0]];
  return taxLotGeometryEvidence(bbl, [{ bbl, the_geom: { type: "Polygon", coordinates: [ring] } }], vertices.map((p, index) => ({
    bbl, the_geom: { type: "LineString", coordinates: [p, ring[index + 1]] }, block_face_flag: boundaryIndices.includes(index) ? "1" : "0",
    tax_lot_face_type: "0", approx_length_flag: "0", lot_face_length_error: "0", lot_face_length: "40"
  })));
}
const origin = [-73.9, 40.85], scale = 0.0001, cosine = Math.cos(origin[1] * Math.PI / 180);
const coordinate = (x, y) => [origin[0] + x * scale / cosine, origin[1] + y * scale];
const obtuse = syntheticGeometry([coordinate(0, 0), coordinate(1, 0), coordinate(1 - Math.sqrt(3) / 2, 0.5), coordinate(-Math.sqrt(3) / 2, 0.5)], [0, 3]);
assert.equal(obtuse.intersections[0].approximateInteriorAngleDegrees, 150, "Do not turn every mapped corner into a qualifying right angle.");
const concave = syntheticGeometry([[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]].map(([x, y]) => coordinate(x, y)), [2, 3]);
assert.equal(concave.intersections[0].approximateInteriorAngleDegrees, 270, "Preserve the parcel's reflex interior angle.");
assert.equal(syntheticGeometry([[0, 0], [2, 2], [0, 2], [3, 0]].map(([x, y]) => coordinate(x, y)), [0, 3]).status, "unresolved",
  "A self-intersecting polygon cannot support an interior-angle finding.");

for (const change of [
  faces => faces.map(face => ({ ...face, block_face_flag: "0" })),
  faces => faces.map(face => ({ ...face, bbl: "2031630002" })),
  faces => faces.map(face => ({ ...face, block_face_flag: "unknown" })),
  faces => faces.map(face => ({ ...face, radius: "20" })),
  faces => faces.map(face => ({ ...face, approx_length_flag: "1" })),
  faces => faces.map(face => ({ ...face, lot_face_length_error: "2" }))
]) assert.equal(taxLotGeometryEvidence(bbl, fixture.polygons, change(fixture.faces)).status, "unresolved");
assert.equal(taxLotGeometryEvidence(bbl, [], fixture.faces).status, "unresolved");
assert.equal(taxLotGeometryEvidence(bbl, [{ ...fixture.polygons[0], bbl: "2031630002" }], fixture.faces).status, "unresolved");
const unavailable = await lookupNYCTaxLotGeometry(bbl, async () => { throw Error("offline"); });
assert.equal(unavailable.status, "unresolved");
assert.equal(unavailable.sources.length, 2);

const projectInformation = { projectID: "project-a", address: "155 E 182nd Street, Bronx" };
const now = Date.parse("2026-10-06T12:00:00Z");
let calls = [];
const lookup = async (address, options) => {
  calls.push({ address, options });
  return { normalizedAddress: "155 EAST 182 STREET, Bronx, NY 10453", bbl, retrievedAt: new Date(now).toISOString(),
    zolaURL: "https://zola.planning.nyc.gov/l/lot/2/3163/1", structuredFacts: [], taxLot: { lotTypeCode: "3", lotType: "Corner",
      recordURL: "https://data.cityofnewyork.us/resource/64uk-42ks.json?bbl=" + bbl,
      dictionaryURL: "https://s-media.nyc.gov/agencies/dcp/assets/files/pdf/data-tools/bytes/pluto_datadictionary.pdf",
      geometry: { ...geometry, sources: unavailable.sources } } };
};
const question = "based on the project address, is this a corner lot site?";
for (const classification of ["corner lot", "interior lot", "through lot", "front lot line", "rear lot line"]) {
  const text = `Based on the project address, is this a ${classification}?`;
  const route = routeResearchCorpora({ question: text, registry: createResearchCorpusRegistry({ zoningResearchEligibility: true }) });
  assert.deepEqual(route.selected.map(corpus => corpus.id), ["nyc-zoning-resolution"]);
  assert.equal(planZoningResearchQuestion({ question: text }).path, "definition_cross_reference");
}
assert.equal(planZoningResearchQuestion({ question: "Based on the project address, is this corner lot in a mapped zoning district?" }).path, "property_map_applicability");
const property = await researchPropertyContext({ question, projectInformation, lookup, now: () => now });
assert.equal(property.status, "retrieved");
assert.deepEqual(calls, [{ address: projectInformation.address, options: { includeLotGeometry: true } }]);
const facts = researchPropertyContextFacts(property);
assert(facts.some(fact => fact.includes("Corner") && fact.includes("PLUTO")));
assert(facts.some(fact => fact.includes("90 degrees") && fact.includes("sif6-3bej")));
assert.match(researchPropertyInvestigationInstruction(property), /explicit condition.*zoning lot follows/);
assert.equal(researchPropertyInvestigationInstruction([]), "");
assert.equal(researchPropertyInvestigationInstruction({ status: "stated", investigationVersion: property.investigationVersion }), "",
  "User wording cannot impersonate a completed official investigation.");
const messages = [{ answer: { propertyResearch: property } }];
await researchPropertyContext({ question, projectInformation, lookup, messages, now: () => now + 1 });
assert.equal(calls.length, 1, "Reuse fresh same-project investigation.");
await researchPropertyContext({ question, projectInformation: { ...projectInformation, projectID: "project-b" }, lookup, messages, now: () => now });
assert.equal(calls.length, 2, "Changing projects must not reuse the previous investigation.");
await researchPropertyContext({ question, projectInformation, lookup, messages, now: () => now + 86_400_001 });
assert.equal(calls.length, 3, "Stale facts require a fresh lookup.");
assert.equal(await researchPropertyContext({ question: "Explain BC 1006.", projectInformation, lookup }), null);
assert.equal(await researchPropertyContext({ question, lookup }), null, "No address means no invented property.");
await researchPropertyContext({ question: "Is 45 Main Street, Brooklyn a corner lot?", projectInformation, lookup });
assert.equal(calls.at(-1).address, "45 Main Street, Brooklyn", "An explicit address overrides the linked project.");

let dispatched = 0;
await assert.rejects(lookupNYCPropertyContext("155 E 182nd Street, Bronx", { fetchImpl: async () => {
  dispatched++;
  return Response.json([{ type: "lot", bbl, label: "600 EAST 182 STREET, Bronx, NY, USA" }]);
} }), /unambiguous/);
assert.equal(dispatched, 1, "Do not look up the first fuzzy geosearch candidate.");
await assert.rejects(lookupNYCPropertyContext("155 E 182nd Street, Bronx", { fetchImpl: async () => Response.json([
  { type: "lot", bbl, label: "155 EAST 182 STREET, Bronx, NY, USA" },
  { type: "lot", bbl: "2031630002", label: "155 EAST 182 STREET, Bronx, NY, USA" }
]) }), /unambiguous/);

const definitions = { ...await zoningSection("20018523"), codePrefix: "ZR" };
const definition = targetedDefinitionExcerpt(definitions, question, { maximumDefinitions: 1, maximumCharacters: 1_100 });
assert.deepEqual(definition.labels, ["lot, corner"]);
assert.match(definition.text, /135 degrees or less/);
assert.match(definition.text, /100 feet from each intersecting street line/);
assert.match(definition.text, /tangent to the curve/);
assert.match(definition.text, /remaining portion.*through lot.*interior lot/);
assert.equal(targetedDefinitionExcerpt(definitions, question, { maximumDefinitions: 1, maximumCharacters: 200 }), null,
  "An alias cannot replace its complete definition when the target does not fit.");
const exactAlias = targetedDefinitionExcerpt(definitions, "corner lot", { completeDefinitionLabels: ["corner lot"] });
assert.deepEqual(exactAlias.labels, ["lot, corner"]);
assert.equal(exactAlias.sectionID, String(definitions.sectionID));
assert.equal(exactAlias.text, definition.text);
function aliasSection(entries) {
  return { codePrefix: "ZR", sectionID: "synthetic-alias", sectionNumber: "12-10", title: "Definitions",
    blocks: entries.map(([label, text]) => ({ html: `<article class="defined-term"><h2 class="definition__title">${label}</h2><p>${text}</p></article>` })) };
}
const chained = targetedDefinitionExcerpt(aliasSection([["alpha", "see beta"], ["beta", "see gamma"], ["gamma", "Complete canonical meaning."]]), "alpha", { allowShortSection: true });
assert.deepEqual(chained.labels, ["gamma"]);
assert.match(chained.text, /Complete canonical meaning/);
for (const entries of [[["alpha", "see beta"]], [["alpha", "see beta"], ["beta", "see alpha"]]]) {
  assert.equal(targetedDefinitionExcerpt(aliasSection(entries), "alpha", { allowShortSection: true }), null, "Missing targets and cycles remain evidence gaps.");
}
console.log("Site investigation contract passed: saved address, fresh project-scoped evidence, parcel identity, mapped straight faces, unknown geometry and complete canonical alias target.");
