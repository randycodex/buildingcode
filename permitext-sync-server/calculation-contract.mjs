import {calculationDraftContent, calculationDraftFingerprint} from './public/calculation-drafts.js';
import {calculateOccupantLoad} from './public/occupant-load-calculation.js';
export {calculationDraftContent, calculationDraftFingerprint};

export function normalizeProjectCalculation(body, projectID) {
  if (typeof body.context !== 'string' || body.context.length > 8192) throw new Error('Invalid calculation source.');
  const context = JSON.parse(body.context);
  if (!Array.isArray(context) || context.length !== 4 || context[0] !== projectID ||
      !context.every(value => typeof value === 'string' && value.length > 0 && value.length <= 4096) ||
      !/^\d+$/.test(context[1]) || !/^(manual|answer:.+)$/.test(context[3])) throw new Error('Calculation belongs to a different Project or source.');
  if (!body.input || typeof body.input !== 'object' || Array.isArray(body.input) || JSON.stringify(body.input).length > 32000) throw new Error('Invalid calculation inputs.');
  const input = JSON.parse(JSON.stringify(body.input));
  if (Object.keys(input).some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) throw new Error('Invalid calculation field.');
  let savedNote;
  if (body.savedNote) {
    if (typeof body.savedNote.id !== 'string' || body.savedNote.id.length > 160 || typeof body.savedNote.title !== 'string' || body.savedNote.title.length > 1000 ||
        typeof body.savedFingerprint !== 'string' || body.savedFingerprint.length > 32000) throw new Error('Invalid calculation Note snapshot.');
    savedNote = {id: body.savedNote.id, title: body.savedNote.title};
  }
  return {projectID, context: JSON.stringify(context), input,
    ...(savedNote ? {savedNote, savedFingerprint: body.savedFingerprint} : {})};
}

export const projectCalculationForClient = artifact => ({id: artifact.envelope.id,
  version: artifact.envelope.version, updatedAt: artifact.envelope.updatedAt,
  ...calculationDraftContent(artifact.payload)});

// Export a reproducible arithmetic snapshot, without creating a Notebook card.
export function normalizeReportCalculation(item, base = {}) {
  const context = JSON.parse(item.context || 'null');
  if (!Array.isArray(context)) throw new Error('Calculation source is unavailable.');
  const payload = normalizeProjectCalculation({context: item.context, input: item.input}, context[0]);
  const calculation = calculateOccupantLoad(payload.input);
  if (!calculation.valid) throw new Error(calculation.errors[0] || 'Complete this calculation before adding it to a Report.');
  if (typeof item.sourceID !== 'string' || !item.sourceID.trim() || item.sourceID.length > 256 ||
      !Number.isSafeInteger(item.sourceVersion) || item.sourceVersion < 1) throw new Error('Invalid calculation snapshot identity.');
  const title = String(item.title || payload.input.spaceName || 'Occupant load calculation').trim();
  if (!title || title.length > 500) throw new Error('Invalid calculation title.');
  const input = {...calculation.input, spaceName: String(payload.input.spaceName || '').trim(),
    spaceLocation: String(payload.input.spaceLocation || '')};
  const custom = input.factorMode === 'custom';
  const edition = context[2].includes('/2022-construction-codes/') ? '2022 NYC Building Code · Table 1004.1.3' : context[2];
  const plainText = [
    `Function of space: ${input.spaceFunction}`,
    ...(input.spaceLocation ? [`Space location (user-stated): ${input.spaceLocation}`] : []),
    `Floor area: ${input.area} ft² ${input.areaBasis}`,
    `${custom ? 'Custom factor' : 'Occupant-load factor'}: ${input.factor} ft²/person`,
    `Occupant load: ${input.area} ÷ ${input.factor} = ${calculation.people} ${calculation.people === 1 ? 'person' : 'people'} (rounded up)`,
    'Seating: Without fixed seating',
    ...(custom ? [`BC table factor: ${input.tableFactor} ft²/person`, `Reason / reference: ${input.customReason}`] : []),
    `Table row and footnotes: ${input.factorBasis}`,
    `Source: ${edition}`,
    'Needs review: confirm applicable footnotes, exceptions, and cumulative occupant loads.'
  ].join('\n');
  return {...base, sourceID: item.sourceID, sourceVersion: item.sourceVersion, title,
    context: payload.context, input, people: calculation.people, plainText};
}
