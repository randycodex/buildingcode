// Complete a declared action from its exact fetched instruction before the
// independent verifier. This is not an answer generator or a verification pass.
export const guidanceActionRepairVersion = "20260909-preview-action-binding-v1";
const compact = value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
const key = value => `${value?.sourceID}\u0000${value?.claimID}`;

export function repairGuidanceDeclaredActions(input, answer) {
  const unchanged = { answer, repairs: [] };
  if (!Array.isArray(input?.passages) || !Array.isArray(answer?.paragraphs)) return unchanged;
  // Require the complete, single-purpose source instruction and its heading.
  // A mention on another page, a longer qualified rule or multiple candidate
  // passages cannot be resolved by guessing from a few shared words.
  const preview = input.passages.filter(passage =>
    compact(passage.heading) === "STEP 6: Preview Submission" &&
    /^Filing through DOB NOW: Build > STEP 6: Preview Submission — • Applicant must review the filing and provide a final electronic signature\.$/.test(compact(passage.text))
  );
  if (preview.length !== 1) return unchanged;
  const source = preview[0];
  if (!source.sourceID || !source.claimID || !/^[a-f0-9]{64}$/.test(source.contentHash || "") ||
      input.passages.filter(passage => key(passage) === key(source)).length !== 1) return unchanged;
  const repairs = [];
  const paragraphs = answer.paragraphs.map((paragraph, paragraphIndex) => {
    if (typeof paragraph?.text !== "string" || !Array.isArray(paragraph.sourceUses)) return paragraph;
    // This completes a step in the document the paragraph already uses. A
    // separately retrieved but unused workflow must not acquire a new claim.
    const sameDocument = paragraph.sourceUses.some(use => input.passages.some(passage =>
      key(passage) === key(use) && passage.sourceID === source.sourceID &&
      passage.contentHash === source.contentHash && passage.url === source.url
    ));
    const alreadyBound = paragraph.sourceUses.some(use => key(use) === key(source));
    if (!sameDocument || (!alreadyBound && paragraph.sourceUses.length >= 8)) return paragraph;
    let text = paragraph.text;
    const explicitReview = /(^|[.!?]\s+)The applicant must review the filing(?:[.;]|\s+and\b)/i.test(text);
    const replacements = [];
    // Limit completion to a positive applicant obligation. Preserve negative,
    // hypothetical and different-actor language for semantic review unchanged.
    const action = /(^|[.!?]\s+)(The applicant must\s+[^.!?;\n]*?)(provide (?:a|the) final electronic signature)(?=[;.]|\s*$)/gi;
    let declared = false;
    text = text.replace(action, (match, boundary, prefix, signature, offset) => {
      if (/\b(?:not|never|unless|if|may|might|could|owner|representative)\b/i.test(prefix)) return match;
      // Do not alter a renderer-inserted source-resolution statement, which
      // has its own exact-text and citation contract.
      const protectedStatement = (answer.sourceResolutions?.relationships || []).some(record =>
        record.paragraphIndex === paragraphIndex && record.statement?.includes(signature)
      );
      if (protectedStatement) return match;
      declared = true;
      if (explicitReview || /\breview\s+the filing\b/i.test(prefix)) return match;
      const replacement = `${boundary}${prefix}review the filing and ${signature}`;
      replacements.push({ offset, before: match, after: replacement });
      return replacement;
    });
    if (!declared || (!replacements.length && alreadyBound)) return paragraph;
    const sourceUses = alreadyBound ? paragraph.sourceUses : [...paragraph.sourceUses, { sourceID: source.sourceID, claimID: source.claimID }];
    repairs.push({ paragraphIndex, sourceID: source.sourceID, claimID: source.claimID,
      sourceContentHash: source.contentHash, sourceText: source.text, replacements,
      addedSourceUse: !alreadyBound });
    return { ...paragraph, text, sourceUses };
  });
  return repairs.length ? { answer: { ...answer, paragraphs }, repairs } : unchanged;
}
