export function researchConversationRevision(conversation) {
  const value = Number(conversation?.revision || 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function researchContextRevision(conversation) {
  const value = Number(conversation?.contextRevision || 0);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function activeResearchMessages(conversation) {
  const revision = researchContextRevision(conversation);
  const legacyMove = conversation?.contextRevision === undefined && conversation?.movedAt;
  return (conversation?.messages || []).filter((message) => {
    if (legacyMove) return Date.parse(message.createdAt) > Date.parse(legacyMove);
    return Number(message.contextRevision || 0) === revision;
  });
}

export function activeResearchTopicContext(conversation) {
  const topic = conversation?.topicContext;
  if (!topic) return null;
  if (topic.contextRevision === undefined && conversation?.movedAt) return null;
  return Number(topic.contextRevision || 0) === researchContextRevision(conversation) ? topic : null;
}

export function resetResearchActiveContext(conversation, now) {
  return {
    ...conversation,
    contextRevision: researchContextRevision(conversation) + 1,
    contextStartedAt: now,
    topicContext: null
  };
}

export function researchConversationConflict(current, incoming = null, contextChanged = Boolean(current && incoming && (
    researchContextRevision(current) !== researchContextRevision(incoming) ||
    String(current?.primaryProjectID || "") !== String(incoming.primaryProjectID || "")
  ))) {
  const error = new Error(contextChanged
    ? "This Research conversation moved to another Project while the answer was being prepared. Review its current context and try again."
    : "This Research conversation changed while the request was running. Review the current conversation and try again.");
  error.code = contextChanged ? "RESEARCH_CONTEXT_CHANGED" : "RESEARCH_CONVERSATION_CHANGED";
  error.statusCode = 409;
  return error;
}

export function assertResearchConversationRevision(current, incoming, expectedRevision) {
  if (!current || researchConversationRevision(current) !== Number(expectedRevision) ||
      researchContextRevision(current) !== researchContextRevision(incoming) ||
      String(current.primaryProjectID || "") !== String(incoming.primaryProjectID || "")) {
    throw researchConversationConflict(current, incoming);
  }
}

// Only explicitly public recovery fields cross either JSON or NDJSON. Provider
// errors, internal costs, request objects and raw diagnostics are not forwarded.
export function researchPublicErrorEnvelope(status, body = {}) {
  const payload = {
    error: String(body.error || body.message || "Research request failed."),
    code: typeof body.code === "string" ? body.code : null
  };
  for (const field of [
    "conversation", "sourceStatuses", "sourceStatus", "usage", "charged",
    "boundary", "zoningPlan", "evidenceGate", "evidenceReadiness", "codeBasis",
    "retrieval", "requestID", "retryAfterSeconds", "currentProjectID", "targetProjectID"
  ]) {
    if (body[field] !== undefined) payload[field] = body[field];
  }
  return { ...payload, status, message: payload.error };
}
