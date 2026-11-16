import {createHash} from 'node:crypto';
import {inlineCodeReferencePhrases} from './public/code-references.js';
import {researchSelectedTables} from './research-table-footnotes.mjs';

export const assistantReferenceVersion = '20261115-explicit-references-v1';
const compact = value => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const authorityFields = ['codePrefix', 'corpusID', 'codeVersion', 'codeEdition', 'jurisdiction'];
const number = String.raw`[A-Z]?\d{2,}(?:-\d+)?(?:\.[0-9A-Za-z-]+)*(?:\([^)]+\))*`;
const bookNames = {'building code':'BC','fuel gas code':'FGC','mechanical code':'MC','plumbing code':'PC',
  'administrative code':'AC','fire code':'FC','zoning resolution':'ZR'};
const tablePattern = new RegExp(String.raw`\b(?:(AC|BC|EBC|ECC|EC|FC|FGC|MC|PC|ZR|(?:New York City\s+)?(?:Building Code|Fuel Gas Code|Mechanical Code|Plumbing Code|Administrative Code|Fire Code|Zoning Resolution))\s+)?Tables?\s+(${number}(?:\s*(?:,\s*(?:(?:and|or)\s+)?|(?:and|or|through|to)\s+)${number})*)`, 'gi');
const tableIdentity = (reference, prefix) => compact(reference).toUpperCase().replace(new RegExp(`^${prefix}\\s+`), '').replace(/^TABLE\s+/, '').replace(/\.$/, '');

// Only text already validated as an attached canonical selection can nominate
// a lookup. Neither the question nor model-written missing-source prose can.
export function assistantExplicitReferences(source) {
  const result = [];
  for (const phrase of inlineCodeReferencePhrases(source.text, {includeFireCode:true})) {
    const precedingBook = source.text.slice(Math.max(0, phrase.start-65), phrase.start).match(/(?:New York City\s+)?(Building Code|Fuel Gas Code|Mechanical Code|Plumbing Code|Administrative Code|Fire Code|Zoning Resolution)\s*$/i);
    const prefix = phrase.codePrefix || bookNames[precedingBook?.[1].toLowerCase()] || source.codePrefix;
    for (const reference of phrase.references) result.push({codePrefix:prefix,
      sectionNumber:reference.referenceNumber.replace(/\.$/, ''), referenceKind:reference.kind});
    // A short explicit same-level range names the intervening numbered
    // provisions too. Every number still has to resolve in the exact catalog.
    const range = source.text.slice(phrase.start, phrase.end).match(/(\d+(?:\.\d+)*\.)?(\d+)\s+(?:through|to)\s+(\d+(?:\.\d+)*\.)?(\d+)$/i);
    if(range && (range[1] || '') === (range[3] || '') && Number(range[4]) > Number(range[2]) && Number(range[4])-Number(range[2]) <= 12){
      for(let value=Number(range[2])+1; value<Number(range[4]); value++)result.push({codePrefix:prefix,
        sectionNumber:`${range[1] || ''}${value}`,referenceKind:phrase.kind});
    }
  }
  for (const match of source.text.matchAll(tablePattern)) {
    const label = compact(match[1]).toLowerCase().replace(/^new york city\s+/, '');
    const prefix = bookNames[label] || match[1]?.toUpperCase() || source.codePrefix;
    for (const item of match[2].matchAll(new RegExp(number, 'gi'))) result.push({codePrefix:prefix,
      sectionNumber:item[0].replace(/\.$/, ''), referenceKind:'table'});
  }
  return [...new Map(result.map(reference => [`${reference.codePrefix}:${reference.referenceKind}:${reference.sectionNumber}`, reference])).values()];
}

export async function expandAssistantReferenceEvidence({evidencePackage, resolveReference, signal, selectedOnly = false,
  maximumReferences = 6, maximumDepth = 2, maximumReads = 12} = {}) {
  const sources = [...evidencePackage.sources];
  const lookup = {version:assistantReferenceVersion, added:[], unresolved:[], attemptedReads:0, selectedOnly};
  const pending = sources.map(source => ({source, depth:0})), visited = new Set();
  let characters = sources.reduce((sum, source) => sum + source.text.length, 0);
  for (let index=0; !selectedOnly && index<pending.length; index++) {
    const {source, depth} = pending[index];
    for (const reference of assistantExplicitReferences(source)) {
      signal?.throwIfAborted();
      const request = {...Object.fromEntries(authorityFields.map(field => [field, source[field]])), ...reference};
      const key = JSON.stringify([...authorityFields.map(field => request[field]), reference.referenceKind, reference.sectionNumber]);
      if (visited.has(key)) continue;
      visited.add(key);
      const missing = reason => lookup.unresolved.push({...request, parentSourceID:source.sourceID, reason});
      if (!authorityFields.every(field => compact(source[field])) || reference.codePrefix !== source.codePrefix) {
        missing('matching_codebook_and_edition_required'); continue;
      }
      if (depth >= maximumDepth || lookup.attemptedReads >= maximumReads || lookup.added.length >= maximumReferences || sources.length >= 24) {
        missing('reference_lookup_limit'); continue;
      }
      lookup.attemptedReads++;
      let found;
      try { found = await resolveReference(request); }
      catch (error) {
        if (signal?.aborted || error?.name === 'AbortError' || error?.code === 'RESEARCH_CANCELLED') throw error;
        missing('canonical_source_unavailable'); continue;
      }
      signal?.throwIfAborted();
      const fullText = found?.canonicalText || found?.text || '';
      const bodyText = found?.body?.blocks?.map(block => block.plainText || '').join('\n\n') || '';
      if (!found || !authorityFields.every(field => found[field] === request[field]) ||
          found.sectionNumber !== reference.sectionNumber || found.referenceOnly || found.researchClaimEligible === false ||
          (found.authorityClass && found.authorityClass !== 'enacted') || (found.authorityStatus && found.authorityStatus !== 'enacted') ||
          found.truncated || found.textComplete === false || found.body?.researchClaimEligible === false || found.body?.truncated ||
          found.sourceBodyState || !compact(bodyText) ||
          ![compact(bodyText), compact([found.sectionNumber, found.title, bodyText].join(' '))].includes(compact(fullText))) {
        missing('complete_authority_not_verified'); continue;
      }
      const tables = researchSelectedTables(fullText, found.richSources);
      if (reference.referenceKind === 'table' && !tables.some(table =>
          tableIdentity(table.reference, found.codePrefix) === reference.sectionNumber.toUpperCase())) {
        missing('complete_table_and_footnotes_unavailable'); continue;
      }
      const snapshotTable = (found.snapshotTables || []).find(table => table.kind === 'table' &&
        tableIdentity(table.reference, found.codePrefix) === reference.sectionNumber.toUpperCase());
      if (snapshotTable && (snapshotTable.text.length > 20_000 || snapshotTable.grids.length > 8 ||
          snapshotTable.grids.some(grid => grid.rows.length > 500 || grid.rows.some(row => row.cells.length > 100)))) {
        missing('complete_table_exceeds_snapshot_limit'); continue;
      }
      // Never trim a table or section to make it fit. Snapshot storage permits
      // 20,000 characters per passage; the existing turn budget is 96,000.
      if (sources.some(existing => authorityFields.every(field => existing[field] === found[field]) &&
          existing.sectionID === found.sectionID && compact(existing.text).includes(compact(fullText)))) continue;
      if (fullText.length > 20_000 || characters + fullText.length > 96_000) {
        missing('complete_source_exceeds_budget'); continue;
      }
      const sourceID = `reference:${createHash('sha256').update(JSON.stringify([key, fullText])).digest('hex').slice(0,32)}`;
      const label = `${found.codePrefix} ${reference.referenceKind === 'table' ? 'Table' : '§'} ${reference.sectionNumber}`;
      const added = {...found, sourceID, text:fullText, canonicalText:fullText, tables,
        // Catalog image metadata is not a captured visual attachment. Retain
        // complete text and grids without pretending to have reviewed images.
        visualSources:[],
        ...(snapshotTable ? {richSourceID:snapshotTable.id, richSourceKind:'table', richSourceReference:snapshotTable.reference,
          richSourceContentHash:snapshotTable.contentHash, richSourceText:snapshotTable.text,
          richSourceRowCount:snapshotTable.rowCount, richSourceGrids:snapshotTable.grids} : {}),
        origin:'permitext_cross_reference', authorityClass:'enacted', canonicalContextComplete:true,
        relationship:`Explicit reference in ${source.codePrefix} § ${source.sectionNumber}`,
        retrievalReason:`Automatically retrieved ${label} from the same codebook and edition`,
        retrievalVersion:assistantReferenceVersion, retrievalDepth:depth+1};
      sources.push(added); pending.push({source:added, depth:depth+1}); characters += fullText.length;
      lookup.added.push({sourceID, parentSourceID:source.sourceID, sectionID:found.sectionID, ...request, label,
        citationID:`S${sources.length}`, unreviewedVisualCount:found.visualSources?.length || 0,
        textHash:createHash('sha256').update(fullText).digest('hex')});
    }
  }
  return {...evidencePackage, sources, referenceLookup:lookup,
    usage:{...evidencePackage.usage, crossReferenceCount:lookup.added.length, finalSourceCount:sources.length, finalCharacterCount:characters},
    limitations:lookup.added.length ? [{code:'EXPLICIT_REFERENCES_ONLY', text:'Attached passages and their explicit references in the same codebook and edition were reviewed; no broad or external search was performed.'},
      ...(lookup.added.some(source=>source.unreviewedVisualCount) ? [{code:'REFERENCED_IMAGES_NOT_REVIEWED',text:'Referenced text and table grids were supplied; figures were not reviewed as images.'}] : [])] : evidencePackage.limitations};
}

export function assistantReferenceCodeBasis(basis, evidencePackage) {
  const added = evidencePackage.referenceLookup?.added || [];
  const checked = evidencePackage.referenceLookup?.attemptedReads || 0;
  return added.length || checked ? {...basis, retrievalScope:'selected-passages-and-explicit-references',
    basisSource:'user-selected-passages-and-explicit-references',
    disclosure:added.length ? `Included passages and ${added.length} explicit ${added.length === 1 ? 'reference' : 'references'} from the same codebook and edition; no broad or external search performed`
      : 'Included passages only; explicit reference lookup supplied no additional complete sources; no broad or external search performed'} : basis;
}
