// Evaluation-only canonical citation resolution. Large dictionaries use exact,
// complete definition entries through the existing application binder. Never
// truncate a definition, relabel its storage carrier, or trust displayed text.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { targetedDefinitionExcerpt, researchBoundDefinitionPublishedReference } from "../research-definition-excerpts.mjs";
const hash = text => createHash("sha256").update(text).digest("hex");
const compact = text => String(text || "").replace(/\s+/g, " ").trim();
export function gradingCanonicalCitation(section, body, citation) {
  assert.equal(String(section.id), citation.sectionID);
  for (const field of ["codePrefix", "corpusID", "codeVersion", "codeEdition"])
    assert.equal(section[field], citation[field], "Cannot migrate a citation across authorities");
  const fullText = (body.blocks || []).map(block => String(block.plainText || "")).filter(Boolean).join("\n\n");
  const carrier = { ...section, sectionID: String(section.id), body, text: fullText };
  const published = citation.publishedCitationReference;
  const mustBindDefinitions = !!published || fullText.length > 48_000;
  const common = { reference: `${citation.codePrefix} ${citation.sectionNumber}`, sectionID: String(section.id),
    ...Object.fromEntries(["codePrefix", "corpusID", "codeVersion", "codeEdition", "jurisdiction"].map(field => [field, section[field]])),
    sectionNumber: citation.sectionNumber, title: citation.title, titleIsMetadata: true };
  if (!mustBindDefinitions) {
    assert.equal(section.sectionNumber, citation.sectionNumber);
    return { ...common, text: fullText, textSHA256: hash(fullText), completeCanonicalRecord: true };
  }
  const entries = new Map(), bindings = [];
  for (const passage of citation.supportingPassages || []) {
    let requiredTextTerms = passage.selectedText.split(/\n\s*\n/).map(v => v.trim()).filter(Boolean);
    if (passage.publishedCitationReference?.heading)
      requiredTextTerms = requiredTextTerms.filter(v => compact(v) !== compact(passage.publishedCitationReference.heading));
    const found = targetedDefinitionExcerpt(carrier, passage.selectedText, {
      requiredTextTerms, allowShortSection: true, maximumCharacters: 12000 });
    assert(found, `${common.reference}: exact complete definition entries required`);
    const complete = targetedDefinitionExcerpt(carrier, passage.selectedText, {
      completeDefinitionLabels: found.labels, allowShortSection: true, maximumCharacters: 12000 });
    assert(complete?.completeDefinitionEntries, "Cannot grade clipped definition conditions");
    assert.equal(compact(complete.text), compact(passage.selectedText), "Selected definitions must equal complete fresh canonical entries");
    if (published) {
      const reference = researchBoundDefinitionPublishedReference(carrier, complete, complete.text);
      assert(reference, "Published definition number requires the existing canonical binder");
      assert.deepEqual(reference, passage.publishedCitationReference, "Preserve published/carrier identities and exact offsets");
      assert.equal(reference.sectionNumber, citation.sectionNumber);
      for (const field of ["version", "basis", "codePrefix", "corpusID", "codeVersion", "codeEdition", "jurisdiction", "sectionNumber", "title", "heading", "carrierSectionID", "carrierSectionNumber", "carrierTitle"])
        assert.equal(published[field], reference[field], "Aggregate published identity must match its canonical carrier");
      assert.deepEqual(published.sourceBindings.find(binding => binding.sourceID === passage.sourceID), {
        sourceID: passage.sourceID, sourceTextHash: reference.sourceTextHash, sourceOffsets: reference.sourceOffsets,
        canonicalEntryBindings: reference.canonicalEntryBindings, selectedTextHash: reference.selectedTextHash });
    } else assert.equal(section.sectionNumber, citation.sectionNumber);
    for (let i = 0; i < complete.labels.length; i++) entries.set(complete.labels[i], complete.passages[i]);
    bindings.push({ sourceID: passage.sourceID, completeDefinitionLabels: complete.labels,
      selectedTextSHA256: hash(passage.selectedText), publishedCitationReference: passage.publishedCitationReference || null });
  }
  assert(entries.size, "Large canonical record cannot be clipped to an arbitrary passage");
  const text = [...entries.values()].join("\n\n");
  return { ...common, text, textSHA256: hash(text), completeCanonicalRecord: false, completeDefinitionEntries: true,
    carrierSectionNumber: section.sectionNumber, carrierTitle: section.title, completeCarrierTextSHA256: hash(fullText),
    canonicalDefinitionBindings: bindings };
}
