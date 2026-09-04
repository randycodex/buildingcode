import assert from "node:assert/strict";
import { projectFactProjection, normalizedResearchProjectStructuredFacts } from "../project-fact-projection.mjs";
import { immutableReportManifest, normalizeReportManifestItem } from "../report-contract.mjs";

const project = {
  id: "synthetic-project", name: "Synthetic Project", address: "", description: "",
  structuredFacts: [
    { id: "stories", key: "stories", label: "Stories", value: "6", status: "confirmed" },
    { id: "sprinklers", key: "sprinkler-status", label: "Sprinklers", value: "Fully sprinklered", status: "stated", sourceText: "Only the ground floor is sprinklered." },
    { id: "status", key: "project-status", label: "Project status", value: "Not an existing building", status: "confirmed" },
    { id: "height", key: "building-height", label: "Height", value: "Unknown", status: "unknown" },
    { id: "occupancy", key: "occupancy", label: "Occupancy", value: "Group R-2", status: "rejected" },
    { id: "assumption", key: "construction-type", label: "Construction", value: "Assume Type IIB construction", status: "stated" },
    { id: "zoning", key: "zoning-districts", label: "Zoning districts", value: "Synthetic district", status: "sourced", source: "fixture", sourceText: "Synthetic source wording." }
  ]
};
const before = structuredClone(project);
const projection = projectFactProjection(project);
assert.deepEqual(project, before, "Project projection must not mutate the live record.");
assert.equal(projection.structuredFacts[0].key, "stories-above-grade");
assert.equal(projection.structuredFacts[1].key, "sprinkler-protection");
assert.equal(projection.structuredFacts[1].value, "Only the ground floor is sprinklered.");
assert.equal(projection.structuredFacts[1].recordedValue, "Fully sprinklered");
assert.equal(projection.structuredFacts[2].value, "Not an existing building");
assert.ok(projection.researchFacts.some((line) => line.includes("hypothetical assumption; not an established condition")));
assert.ok(projection.researchFacts.some((line) => line.startsWith("Unknown: ") && line.includes("Height")));
assert.ok(!projection.researchFacts.some((line) => line.includes("Group R-2")), "Rejected values are excluded from active Research.");
assert.ok(projection.reportFacts.includes("rejected; excluded from active Research"));
assert.ok(projection.reportFacts.includes("sourced data; verify current official records"));
assert.ok(!projection.reportFacts.includes("NYC Planning sourced"), "A source label must not invent provenance.");
assert.ok(!projection.reportFacts.includes("Fully sprinklered"), "The old inflated value is provenance, not Report prose.");
assert.ok(projection.reportFacts.includes("Not an existing building"));
assert.ok(projection.reportFacts.length, "A structured-only Project must have a Report facts source.");
assert.deepEqual(normalizedResearchProjectStructuredFacts({ structuredFacts: projection.structuredFacts }), projection.structuredFacts, "Projection is stable under manifest normalization.");

const item = {
  id: "facts-item", kind: "projectFacts", sourceID: project.id, title: project.name,
  address: projection.address, facts: projection.reportFacts,
  structuredFacts: projection.structuredFacts, projectionVersion: projection.projectionVersion
};
const manifest = immutableReportManifest({
  id: "synthetic-manifest", project, draftID: "synthetic-draft", title: "Synthetic Report",
  reportDate: "2026-09-04", author: { userID: "synthetic-user", displayName: "Synthetic Reviewer" },
  codeEdition: "2022 Construction Codes", items: [item], disclaimers: [], reportVersion: 1,
  sourceVersions: [], createdAt: "2026-09-04T12:00:00.000Z"
});
const snapshot = structuredClone(manifest);
project.structuredFacts[1].value = "Later revision";
projection.structuredFacts[1].value = "Another later revision";
assert.deepEqual(manifest, snapshot, "An issued manifest owns its fact snapshot.");
assert.equal(manifest.items[0].structuredFacts[1].value, "Only the ground floor is sprinklered.");

const legacy = normalizeReportManifestItem({
  id: "legacy", kind: "projectFacts", sourceID: "legacy-project", facts: "Historical description"
});
assert.equal(legacy.facts, "Historical description");
assert.equal(Object.hasOwn(legacy, "structuredFacts"), false, "Historical manifests remain readable without invented fact metadata.");
console.log("Permitext qualified Project fact projection and Report snapshot contract passed.");
