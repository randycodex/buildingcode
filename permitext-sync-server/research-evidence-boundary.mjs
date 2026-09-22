// Deterministic source-boundary copy shared by delivery and immutable storage.
export function explicitlyMissingResearchDocument(question = "") {
  const unavailable = "(?:I |we )?(?:have not|haven['’]t|has not|hasn['’]t|was not|is not|not) (?:provided|supplied|shared)";
  const requestedDocuments = [
    { noun: "(?:lender['’]s? )?(?:accessibility )?rider", label: "rider" },
    { noun: "(?:project[- ]specific |project )?(?:technical )?specifications?", label: "project specification" },
    { noun: "(?:funding[- ]program |program )requirements", label: "program requirements" },
    { noun: "(?:manufacturer['’]s? )instructions", label: "manufacturer’s instructions" }
  ];
  const missingDocument = requestedDocuments.find(({ noun }) =>
    new RegExp(`\\b${noun} (?:that |which )?${unavailable}\\b|\\b${unavailable} (?:the |a |our )?${noun}\\b`, "i").test(question)
  );
  return missingDocument || null;
}

export function researchEvidenceBoundaryInterpretation(question = "") {
  const missingDocument = explicitlyMissingResearchDocument(question);
  if (missingDocument) {
    const label = missingDocument.label;
    const conclusion = `I can’t answer from the ${label} without its text.`;
    const explanation = `The relevant text has not been provided. Building Code minimums do not establish what that separate document says. Paste the relevant clause, including any exceptions or definitions it refers to, so the specific requirement can be reviewed.`;
    return {
      answerText: `${conclusion}\n\n${explanation}`, conclusion, explanation,
      supportedPoints: [], assumptions: [], missingFacts: [],
      followUpQuestions: [`Can you paste the relevant clause from the ${label}?`],
      evidenceLimitations: [`The requested document text is unavailable; no conclusion about its contents has been made.`],
      additionalEvidenceNeeded: [`The ${label}’s relevant clause and referenced exceptions or definitions.`],
      supportingSourceUses: [], supportingSources: [], citations: []
    };
  }
  const conclusion = "The enacted evidence Permitext reviewed does not establish a requirement responsive to this question.";
  const explanation = "Permitext cannot support a substantive code conclusion from this evidence set. The reviewed passages are not cited because they do not govern the question.";
  return {
    answerText: `${conclusion}\n\n${explanation}`,
    conclusion,
    supportedPoints: [],
    explanation,
    assumptions: [],
    missingFacts: [],
    followUpQuestions: [
      "Can you provide an applicable code section or narrow the question to a specific code topic?"
    ],
    evidenceLimitations: [
      "The reviewed evidence contains no governing enacted provision that answers this question."
    ],
    additionalEvidenceNeeded: [
      "Add the enacted provision or official authority governing the requested requirement before relying on a substantive answer."
    ],
    supportingSourceUses: [],
    supportingSources: [],
    citations: []
  };
}

