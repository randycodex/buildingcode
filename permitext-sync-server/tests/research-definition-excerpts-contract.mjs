import assert from "node:assert/strict";
import {
  researchDefinitionExcerptLimits,
  targetedDefinitionExcerpt
} from "../research-definition-excerpts.mjs";
import {
  assembleResearchEvidence,
  researchEvidenceAssemblyLimits
} from "../research-evidence-assembly.mjs";
import { withOfflineResearchHTTPHarness } from "./research-benchmark-http-harness.mjs";
import { zoningSection } from "../zoning-content.mjs";

const syntheticDefinitionSection = {
  sectionID: "definition-202",
  codePrefix: "BC",
  sectionNumber: "202",
  title: "SECTION 202: Definitions",
  codeEdition: "2022",
  codeVersion: "2022 NYC Building Code",
  jurisdiction: "New York City",
  canonicalText: `Definitions ${"filler ".repeat(3_000)}`,
  body: {
    blocks: [{
      html: [
        '<div class="Normal-Level">ACCESSIBLE UNIT. Exact accessible-unit definition.</div>',
        '<div class="Normal-Level">UNRELATED TERM. This definition must not be selected.</div>',
        '<div class="Normal-Level">TYPE B UNIT. Exact Type B definition.</div>',
        '<div class="Normal-Level">TYPE B + NYC UNIT. Exact Type B+NYC definition.</div>'
      ].join("\n")
    }]
  }
};

const excerpt = targetedDefinitionExcerpt(
  syntheticDefinitionSection,
  "Compare Accessible units, Type B units, and Type B+NYC units.",
  { maximumCharacters: 1_000 }
);

assert(excerpt, "A giant canonical definition section must support targeted enacted entries.");
assert.deepEqual(excerpt.labels, ["ACCESSIBLE UNIT", "TYPE B UNIT", "TYPE B + NYC UNIT"]);
assert.match(excerpt.text, /Exact accessible-unit definition/);
assert.match(excerpt.text, /Exact Type B definition/);
assert.match(excerpt.text, /Exact Type B\+NYC definition/);
assert.doesNotMatch(excerpt.text, /UNRELATED TERM|must not be selected/);
assert.equal(excerpt.sectionID, syntheticDefinitionSection.sectionID);
assert.equal(excerpt.codePrefix, syntheticDefinitionSection.codePrefix);
assert.equal(excerpt.sectionNumber, syntheticDefinitionSection.sectionNumber);
assert.equal(excerpt.codeEdition, syntheticDefinitionSection.codeEdition);
assert.equal(excerpt.codeVersion, syntheticDefinitionSection.codeVersion);
assert.equal(excerpt.jurisdiction, syntheticDefinitionSection.jurisdiction);
assert.equal(excerpt.canonicalContextComplete, false);
assert(excerpt.excerptCharacterCount <= 1_000);
assert.equal(
  targetedDefinitionExcerpt(
    { ...syntheticDefinitionSection, sectionNumber: "203", title: "General", canonicalText: "short" },
    "Accessible unit"
  ),
  null,
  "Ordinary short sections must remain on the normal canonical-source path."
);
assert.equal(
  targetedDefinitionExcerpt(syntheticDefinitionSection, "Question with no matching defined term"),
  null,
  "A definition section must not emit arbitrary beginning text when no term matches."
);

const question = "In a residential project containing 100 dwelling units, explain which categories of accessible units must be considered and what additional project information is necessary to calculate the required quantities.";

await withOfflineResearchHTTPHarness("definition-excerpts", async ({ discover, resolveSection }) => {
  const assembled = await assembleResearchEvidence({ question, discover, resolveSection });
  const definitionSource = assembled.sources.find((source) =>
    source.sectionID === "113" && source.codePrefix === "BC" && source.sectionNumber === "202"
  );

  assert(
    definitionSource,
    "BC 202 must be reserved for targeted definitions even when ten controlling provisions fill the discovered-source limit."
  );
  assert.equal(assembled.usage.discoveredCount, researchEvidenceAssemblyLimits.maximumDiscovered);
  assert(
    assembled.usage.targetedDefinitionCount > 0 &&
      assembled.usage.targetedDefinitionCount <= researchEvidenceAssemblyLimits.maximumTargetedDefinitions,
    "Targeted definition sources must use a separate bounded budget."
  );
  assert.equal(definitionSource.origin, "permitext_discovered");
  assert.equal(definitionSource.canonicalContextResolved, true);
  assert.equal(definitionSource.canonicalContextComplete, false);
  assert.equal(definitionSource.truncated, false);
  assert.equal(definitionSource.targetedDefinition.sectionID, definitionSource.sectionID);
  assert.equal(definitionSource.targetedDefinition.codePrefix, definitionSource.codePrefix);
  assert.equal(definitionSource.targetedDefinition.sectionNumber, definitionSource.sectionNumber);
  assert.equal(definitionSource.targetedDefinition.codeVersion, definitionSource.codeVersion);
  assert.equal(definitionSource.targetedDefinition.jurisdiction, definitionSource.jurisdiction);
  assert(definitionSource.targetedDefinition.canonicalSectionCharacterCount > 200_000);
  assert(definitionSource.text.length <= researchEvidenceAssemblyLimits.maximumCharactersPerSource);
  assert.match(definitionSource.text, /ACCESSIBLE UNIT/);
  assert.match(definitionSource.text, /TYPE B UNIT/);
  assert.match(definitionSource.text, /TYPE B \+ NYC UNIT/);
  assert.doesNotMatch(definitionSource.text, /WINDER|AUTOMATIC SPRINKLER SYSTEM/);
  assert(
    assembled.limitations.some((limitation) => limitation.kind === "targeted-definition-excerpt"),
    "The evidence package must disclose that a targeted excerpt represents a larger canonical section."
  );
});

assert.equal(researchDefinitionExcerptLimits.maximumCharacters, 12_000);
assert.equal(researchEvidenceAssemblyLimits.maximumTargetedDefinitions, 2);

const zoningDefinitions = { ...await zoningSection("20018523"), codePrefix: "ZR" };
for (const query of [
  "Can two tax lots under common ownership become one zoning lot?",
  "Two tax lots have the same owner and a short common boundary. Can they be treated as one zoning lot?"
]) {
  const value = targetedDefinitionExcerpt(zoningDefinitions, query);
  assert.deepEqual(value.labels, ["zoning lot"]);
  assert.match(value.text, /contiguous for a minimum of 10 linear feet/);
  const complete = targetedDefinitionExcerpt(zoningDefinitions, "zoning lot", { requiredTextTerms: ["zoning lot"] });
  assert.equal(value.text, complete.text, "The complete ownership pathways must survive, not just an alias.");
}
for (const query of [
  "Does a below-grade storage level count as zoning floor area?",
  "How does the zoning floor area definition treat basements and cellars?"
]) {
  const value = targetedDefinitionExcerpt(zoningDefinitions, query);
  assert.deepEqual(value.labels, ["basement", "cellar", "floor area"]);
  for (const [index, label] of value.labels.entries()) {
    const complete = targetedDefinitionExcerpt(zoningDefinitions, label, { requiredTextTerms: [label] });
    assert.equal(value.passages[index], complete.text, `${label}: preserve the full definition and closing conditions.`);
  }
  assert.match(value.text, /sloping base plane/);
  assert.match(value.text, /dwelling purposes/);
}

const housingDefinitions = { ...await zoningSection("20022699"), codePrefix: "ZR" };
for (const query of [
  "What qualifying affordable housing facts establish that a higher FAR is available?",
  "Which definitions control the floor area allowance for qualifying affordable housing?"
]) {
  const value = targetedDefinitionExcerpt(housingDefinitions, query, { maximumCharacters: 4_301 });
  assert.deepEqual(value.labels, ["Affordable floor area", "Affordable housing regulatory agreement", "MIH development", "UAP development"]);
  assert.match(value.text, /only by the amount of affordable housing provided/);
  for (const [index, label] of value.labels.entries()) {
    const complete = targetedDefinitionExcerpt(housingDefinitions, label, { maximumCharacters: 4_301, requiredTextTerms: [label] });
    assert.equal(value.passages[index], complete.text, `${label}: preserve each full chapter definition.`);
  }
}
console.log("research definition excerpt contract passed");
