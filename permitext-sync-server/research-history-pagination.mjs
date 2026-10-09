import { createHash } from "node:crypto";

function invalidHistory(message, code = "INVALID_RESEARCH_HISTORY_QUERY") {
  return Object.assign(new Error(message), { code, status: 400 });
}

export function researchHistoryOptions(body, userID) {
  if (!["limit", "cursor", "q", "projectID"].some(key => Object.hasOwn(body, key))) return null;
  const limit = body.limit === undefined ? 30 : body.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalidHistory("History page size must be an integer from 1 to 100.");
  }
  if ((body.q !== undefined && typeof body.q !== "string") || (body.q?.length || 0) > 200) {
    throw invalidHistory("History search must be text of at most 200 characters.");
  }
  const projectFiltered = Object.hasOwn(body, "projectID");
  if (projectFiltered && (typeof body.projectID !== "string" || body.projectID.length > 256)) {
    throw invalidHistory("History Project must be an identifier or an empty string for unassigned.");
  }
  const q = (body.q || "").trim().toLowerCase();
  const projectID = projectFiltered ? body.projectID.trim() : null;
  // This cursor is a position, never an authorization token. Every query still
  // requires the authenticated owner. Hash the scope to avoid exposing its ID.
  const scope = createHash("sha256").update(JSON.stringify([1, userID, q, projectID])).digest("base64url");
  const options = { limit, q, projectID, scope, after: null };
  if (body.cursor !== undefined && body.cursor !== null && body.cursor !== "") {
    try {
      if (typeof body.cursor !== "string" || body.cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(body.cursor)) throw Error();
      const cursor = JSON.parse(Buffer.from(body.cursor, "base64url").toString("utf8"));
      if (cursor.v !== 1 || cursor.s !== scope || typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 512 ||
          typeof cursor.d !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(cursor.d) ||
          !Number.isFinite(Date.parse(cursor.d)) || new Date(cursor.d).toISOString().slice(0, 19) !== cursor.d.slice(0, 19)) throw Error();
      options.after = { date: cursor.d, id: cursor.id };
    } catch {
      throw invalidHistory("This history cursor is invalid or belongs to another search. Refresh the history.", "INVALID_RESEARCH_HISTORY_CURSOR");
    }
  }
  return options;
}

export function researchHistoryCursor(options, row) {
  return Buffer.from(JSON.stringify({ v: 1, s: options.scope, d: row.sortDate, id: row.conversation.id })).toString("base64url");
}

function originalQuestion(conversation) {
  return String(conversation.starterQuestion || "").trim() ||
    String((Array.isArray(conversation.messages) ? conversation.messages : []).find(message => message?.role === "user")?.question || "").trim();
}

export function researchHistoryFileRows(conversations, options, projectSummary) {
  return conversations
    .filter(conversation => !conversation.historyHiddenAt &&
      (options.projectID === null || String(conversation.primaryProjectID || "") === options.projectID) &&
      (!options.q || [conversation.title || "", originalQuestion(conversation)].some(value => String(value).toLowerCase().includes(options.q))))
    .map(conversation => ({ conversation, sortDate: new Date(Number.isFinite(Date.parse(conversation.createdAt)) ? conversation.createdAt : 0).toISOString() }))
    .filter(row => !options.after || Date.parse(row.sortDate) < Date.parse(options.after.date) ||
      (Date.parse(row.sortDate) === Date.parse(options.after.date) && row.conversation.id > options.after.id))
    .sort((left, right) => Date.parse(right.sortDate) - Date.parse(left.sortDate) ||
      (left.conversation.id < right.conversation.id ? -1 : left.conversation.id > right.conversation.id ? 1 : 0))
    .slice(0, options.limit + 1)
    .map(row => ({ ...row, conversation: projectSummary(row.conversation) }));
}

// Limit before projecting summaries: complete messages, source bodies and
// visuals stay inside PostgreSQL. No OFFSET or all-history application read.
export function researchHistoryPageQuery(userID, options) {
  const values = [userID];
  const bind = value => { values.push(value); return `$${values.length}`; };
  const conditions = ["user_id = $1", "COALESCE(conversation->>'historyHiddenAt', '') = ''"];
  if (options.projectID !== null) conditions.push(`COALESCE(conversation->>'primaryProjectID', '') = ${bind(options.projectID)}`);
  const questionSQL = `COALESCE(NULLIF(BTRIM(conversation->>'starterQuestion'), ''), (
    SELECT NULLIF(BTRIM(message->>'question'), '') FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(conversation->'messages') = 'array' THEN conversation->'messages' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS original_message(message, position)
    WHERE message->>'role' = 'user' ORDER BY position LIMIT 1
  ), '')`;
  if (options.q) {
    const search = bind(options.q);
    conditions.push(`(POSITION(${search} IN LOWER(COALESCE(conversation->>'title', ''))) > 0 OR POSITION(${search} IN LOWER(${questionSQL})) > 0)`);
  }
  if (options.after) {
    const date = bind(options.after.date), id = bind(options.after.id);
    conditions.push(`(created_at < ${date}::timestamptz OR (created_at = ${date}::timestamptz AND id COLLATE "C" > ${id}))`);
  }
  const limit = bind(options.limit + 1);
  return { values, text: `WITH page AS MATERIALIZED (
    SELECT id, conversation, created_at FROM permitext_research_conversations
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC, id COLLATE "C" ASC LIMIT ${limit}
  )
  SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_date, jsonb_build_object(
    'id', id, 'title', conversation->>'title',
    'createdAt', conversation->>'createdAt', 'updatedAt', conversation->>'updatedAt',
    'historyHiddenAt', conversation->>'historyHiddenAt',
    'primaryProjectID', conversation->>'primaryProjectID',
    'starterQuestion', ${questionSQL},
    'projectContextReviewRequired', COALESCE((conversation->>'projectContextReviewRequired')::boolean, false),
    'codeBasis', conversation->'codeBasis',
    'sourceStatus', COALESCE(conversation->>'sourceStatus', 'current'),
    'historyContentFacts', jsonb_build_object(
      'schemaVersion', 1,
      'complete', COALESCE(jsonb_typeof(conversation->'messages') = 'array' AND jsonb_typeof(conversation->'sources') = 'array', false),
      'hasMessages', CASE WHEN jsonb_typeof(conversation->'messages') = 'array' THEN jsonb_array_length(conversation->'messages') > 0 ELSE false END
        OR CASE WHEN jsonb_typeof(conversation->'messageCount') = 'number' THEN (conversation->>'messageCount')::numeric > 0 ELSE false END,
      'hasSources', CASE WHEN jsonb_typeof(conversation->'sources') = 'array' THEN jsonb_array_length(conversation->'sources') > 0 ELSE false END,
      'hasAttachments', COALESCE(conversation->'attachments' NOT IN ('null'::jsonb, '[]'::jsonb, '""'::jsonb), false) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(conversation->'sources') = 'array' THEN conversation->'sources' ELSE '[]'::jsonb END) AS retained_source
        WHERE COALESCE(retained_source->'visualSources' NOT IN ('null'::jsonb, '[]'::jsonb, '""'::jsonb), false)
          OR COALESCE(retained_source->'richSourceID' NOT IN ('null'::jsonb, '[]'::jsonb, '""'::jsonb), false)
          OR COALESCE(retained_source->'richSourceGrids' NOT IN ('null'::jsonb, '[]'::jsonb, '""'::jsonb), false)),
      'hasRetainedContext', EXISTS (SELECT 1 FROM jsonb_object_keys(conversation) AS content_key
        WHERE content_key NOT IN ('id','title','titleSource','createdAt','updatedAt','historyHiddenAt','codeVersion','evidenceSetVersion','primaryProjectID','starterQuestion','projectContextReviewRequired','sourceStatus','sources','messages','origin','historyContentFacts') AND conversation->content_key <> 'null'::jsonb)
        OR (conversation->'origin' IS NOT NULL AND conversation->'origin' <> 'null'::jsonb AND conversation->'origin' <> '{"kind":"chat"}'::jsonb),
      'hasTitleIntent', COALESCE(conversation->>'titleSource', '') <> 'default'),
    'messageCount', CASE WHEN jsonb_typeof(conversation->'messages') = 'array' THEN jsonb_array_length(conversation->'messages') ELSE 0 END,
    'sources', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'kind', 'selection', 'sectionID', src->>'sectionID', 'sectionNumber', src->>'sectionNumber',
      'title', src->>'title', 'codePrefix', src->>'codePrefix', 'selectedText', LEFT(src->>'selectedText', 240)))
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(conversation->'sources') = 'array' THEN conversation->'sources' ELSE '[]'::jsonb END) AS src
      WHERE src->>'kind' = 'selection'), '[]'::jsonb)
  ) AS conversation FROM page ORDER BY created_at DESC, id COLLATE "C" ASC` };
}
