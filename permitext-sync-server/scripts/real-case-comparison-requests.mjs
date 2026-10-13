import { sha256 } from "./real-case-comparison-dataset.mjs";
import { researchPracticalNextStepInstruction } from "../research-practical-next-step.mjs";

export const comparisonInstructions = Object.freeze({
  minimal: "Answer the user's question. Return the required JSON format and use the supplied identifiers for any citations to supplied sources.",
  simplified: [
    "Answer the NYC code question directly, leading with the strongest conclusion supported by the available evidence.",
    "Treat supplied scenario facts as premises. Apply the enacted evidence with its material scope, exceptions and conditions, and cite the exact supplied identifiers.",
    "Give useful conditional conclusions when a remaining fact prevents a final determination. State the specific unresolved point once; ask a follow-up only when it materially changes the answer.",
    "Do not invent facts, requirements or citations. Distinguish an evidence gap from a prohibition. Return the required JSON format."
  ].join(" ")
});

export function writerComparisonRequests({ currentRequest, question, sourceBlock, sharedContext = null }) {
  if (currentRequest.instructions.includes(researchPracticalNextStepInstruction) ||
      ["supportedPoints", "citations", "followUpQuestions"].some(field => currentRequest.text?.format?.schema?.properties?.[field]?.maxItems === 0)) {
    throw Error("Substantive code comparison cannot force guidance-only or recall mode.");
  }
  if (typeof currentRequest.input !== "string" || !currentRequest.input.startsWith(`QUESTION\n${question}\n\n`)) throw Error("Unexpected current writer input layout.");
  const first = currentRequest.input.indexOf(sourceBlock);
  if (first < 0 || currentRequest.input.indexOf(sourceBlock, first + 1) >= 0) throw Error("Enacted evidence block must appear exactly once.");
  if (currentRequest.tools?.length || currentRequest.previous_response_id || currentRequest.conversation) throw Error("Writer comparison must be a bounded single request.");
  const questionBlock = `QUESTION\n${question}`;
  const prefix = currentRequest.input.slice(questionBlock.length, first).trim();
  const suffix = currentRequest.input.slice(first + sourceBlock.length).trim();
  const commonInput = [questionBlock, sharedContext ? `SHARED RESEARCH CONTEXT DATA\n${JSON.stringify(sharedContext)}` : "", sourceBlock].filter(Boolean).join("\n\n");
  const instructions = {
    ...comparisonInstructions,
    // Preserve current policies from both the instructions field and its
    // mixed instruction/data input. All arms now receive identical data.
    current: [currentRequest.instructions, prefix, suffix].filter(Boolean).join("\n\n")
  };
  return Object.fromEntries(Object.entries(instructions).map(([arm, instruction]) => [arm, {
    ...structuredClone(currentRequest),
    store: false,
    input: commonInput,
    instructions: instruction
  }]));
}

export function assertWriterControls(requests) {
  const bodies = Object.values(requests);
  if (bodies.length !== 3) throw Error("Exactly three arms are required.");
  const identity = body => sha256(JSON.stringify({ model: body.model, input: body.input, reasoning: body.reasoning, text: body.text, max_output_tokens: body.max_output_tokens, service_tier: body.service_tier, store: body.store }));
  if (new Set(bodies.map(identity)).size !== 1) throw Error("Only writer instructions may differ between arms.");
  if (new Set(bodies.map(body => body.instructions)).size !== 3) throw Error("Comparison arms must have distinct instructions.");
  return { commonRequestSHA256: identity(bodies[0]), inputSHA256: sha256(bodies[0].input), evidenceIdenticalAcrossArms: true };
}
