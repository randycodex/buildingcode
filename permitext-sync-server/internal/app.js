const accountSessionKey = "permitext:webAccount:v1";
const statusElement = document.querySelector("#status");
const summaryElement = document.querySelector("#summary");
const tabs = document.querySelector(".tabs");
const panels = Object.fromEntries([...document.querySelectorAll(".tab-panel")].map((panel) => [panel.id, panel]));
let data = null;
let selectedCaseID = "";

function account() {
  try {
    const value = JSON.parse(localStorage.getItem(accountSessionKey) || "null");
    return value?.userID && value?.sessionToken ? value : null;
  } catch {
    return null;
  }
}

async function internalRequest(path, values = {}) {
  const current = account();
  if (!current) throw new Error("Sign in to Permitext in this browser before opening the owner console.");
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${current.sessionToken}` },
    body: JSON.stringify({ auth: { accountUserID: current.userID }, ...values })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

function element(name, options = {}) {
  const node = document.createElement(name);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}

function appendList(parent, title, items) {
  parent.append(element("h3", { text: title }));
  const list = element("ul");
  (items || []).forEach((item) => list.append(element("li", { text: item })));
  if (!items?.length) list.append(element("li", { text: "None" }));
  parent.append(list);
}

function renderSummary() {
  const approved = data.dataset.cases.filter((item) => item.status === "approved").length;
  summaryElement.replaceChildren();
  [["Cases", data.dataset.cases.length], ["Approved", approved], ["Saved runs", data.runs.length], ["Feedback candidates", data.feedbackCandidates.length]].forEach(([label, value]) => {
    const card = element("article");
    card.append(element("strong", { text: value }), element("span", { text: label }));
    summaryElement.append(card);
  });
  summaryElement.hidden = false;
}

async function saveReview(values, formStatus) {
  formStatus.textContent = "Saving review…";
  try {
    await internalRequest("/internal/evaluations/review", values);
    formStatus.textContent = "Review saved.";
    await loadData();
  } catch (error) {
    formStatus.textContent = error.message;
  }
}

function reviewForm(testCase, options = {}) {
  const form = element("section", { className: "review-form" });
  form.append(element("h3", { text: options.runID ? "Human run review" : "Case decision" }));
  const reviewer = element("input");
  reviewer.placeholder = "Reviewer";
  reviewer.value = testCase.reviewer || "Permitext owner";
  const notes = element("textarea");
  notes.rows = 3;
  notes.placeholder = "Reviewer notes";
  const overrides = {};
  if (options.metrics) {
    Object.entries(options.metrics).forEach(([dimension, metric]) => {
      const row = element("label", { className: "metric" });
      row.append(element("span", { text: `${dimension}: ${metric.rationale}` }));
      const input = element("input");
      input.type = "number";
      input.min = "0";
      input.max = "4";
      input.step = ".01";
      input.placeholder = String(metric.score);
      input.addEventListener("input", () => {
        if (input.value === "") delete overrides[dimension];
        else overrides[dimension] = Number(input.value);
      });
      row.append(input);
      form.append(row);
    });
  }
  const actions = element("div", { className: "actions" });
  const approve = element("button", { text: "Approve" });
  const reject = element("button", { className: "reject", text: "Reject" });
  const result = element("p", { className: "meta" });
  [approve, reject].forEach((button) => {
    button.type = "button";
    button.addEventListener("click", () => saveReview({
      kind: options.runID ? "run" : "case",
      caseID: testCase.id,
      runID: options.runID || "",
      decision: button === approve ? "approved" : "rejected",
      reviewer: reviewer.value,
      notes: notes.value,
      scoreOverrides: overrides
    }, result));
  });
  actions.append(approve, reject);
  form.prepend(reviewer, notes);
  form.append(actions, result);
  return form;
}

function latestReview(kind, caseID, runID = null) {
  return [...(data.reviews || [])].reverse().find((review) =>
    review.kind === kind && review.caseID === caseID && (kind !== "run" || review.runID === runID)
  );
}

function appendPreviousReview(parent, review) {
  if (!review) return;
  const card = element("aside", { className: "evidence" });
  card.append(element("strong", { text: `Latest human decision: ${review.decision}` }));
  card.append(element("p", { className: "meta", text: `${review.reviewer} · ${review.reviewedAt}` }));
  if (review.notes) card.append(element("p", { text: review.notes }));
  if (Object.keys(review.scoreOverrides || {}).length) {
    card.append(element("p", { className: "meta", text: `Overrides: ${JSON.stringify(review.scoreOverrides)}` }));
  }
  parent.append(card);
}

function caseDetail(testCase) {
  const detail = element("article", { className: "card" });
  detail.append(element("h2", { text: testCase.title }));
  const meta = element("p", { className: "meta", text: `${testCase.id} · ${testCase.codeEdition} · ${testCase.difficulty} · ${testCase.sourceType}` });
  detail.append(meta);
  detail.append(element("p", { className: "meta", text: `${testCase.jurisdiction || "Jurisdiction unavailable"} · ${testCase.sourceReference || "Source reference unavailable"}` }));
  testCase.topics.forEach((topic) => detail.append(element("span", { className: "badge", text: topic })));
  detail.append(
    element("h3", { text: "Project context" }),
    element("div", { className: "evidence", text: JSON.stringify(testCase.projectContext, null, 2) })
  );
  detail.append(element("h3", { text: "Question" }), element("p", { text: testCase.question }));
  detail.append(element("h3", { text: "Selected evidence" }));
  testCase.selectedEvidence.forEach((source) => {
    detail.append(element("strong", { text: `${source.reference} · canonical section ${source.sectionID || "legacy result"}` }));
    source.exactPassages.forEach((passage) => detail.append(element("div", { className: "evidence", text: passage })));
  });
  const expectedLevel = testCase.expectedUncertainty?.level || testCase.expectedCertainty || "unspecified";
  const expectedDescription = testCase.expectedUncertainty?.description || "";
  detail.append(element("h3", { text: `Expected conclusion (${expectedLevel})` }), element("p", { text: testCase.expectedConclusion }));
  if (expectedDescription) detail.append(element("p", { className: "meta", text: expectedDescription }));
  appendList(detail, "Required citations", testCase.requiredCitations);
  appendList(detail, "Required concepts", testCase.requiredConcepts);
  appendList(detail, "Missing facts", testCase.missingFacts);
  appendList(detail, "Forbidden claims", testCase.forbiddenClaims);
  if (testCase.notes) detail.append(element("h3", { text: "Case notes" }), element("p", { text: testCase.notes }));
  appendPreviousReview(detail, latestReview("case", testCase.id));
  detail.append(reviewForm(testCase));
  return detail;
}

function renderCases() {
  const wrapper = element("div", { className: "split" });
  const list = element("aside", { className: "card list" });
  const detail = element("section");
  const cases = data.dataset.cases;
  selectedCaseID ||= cases[0]?.id || "";
  cases.forEach((testCase) => {
    const button = element("button");
    button.setAttribute("aria-pressed", String(testCase.id === selectedCaseID));
    button.append(element("strong", { text: testCase.title }), element("div", { className: `badge ${testCase.status}`, text: testCase.status }));
    button.addEventListener("click", () => { selectedCaseID = testCase.id; renderCases(); });
    list.append(button);
  });
  const selected = cases.find((item) => item.id === selectedCaseID);
  if (selected) detail.append(caseDetail(selected));
  wrapper.append(list, detail);
  panels.cases.replaceChildren(wrapper);
}

function runLabel(run) {
  return `${run.createdAt || "Unknown date"} · ${run.configuration?.answerModel || "model"} · ${run.configuration?.promptVersion || "prompt"}`;
}

function answerText(result) {
  const answer = result?.answer;
  return answer ? [
    answer.conclusion,
    answer.explanation,
    ...(answer.assumptions || []).map((item) => `Assumption: ${item}`),
    ...(answer.missingFacts || []).map((item) => `Missing fact: ${item}`),
    ...(answer.evidenceLimitations || []).map((item) => `Evidence limitation: ${item}`),
    ...(answer.additionalEvidenceNeeded || []).map((item) => `Additional evidence: ${item}`)
  ].join("\n\n") : "No result for this case.";
}

function runResultCard(run, caseID) {
  const result = run?.results?.find((item) => item.testCase.id === caseID);
  const card = element("article", { className: "card" });
  card.append(element("h2", { text: run ? runLabel(run) : "No run selected" }));
  if (!result) return card;
  if (result.error) {
    card.append(element("p", { className: "fail", text: `ERROR · ${result.error.message}` }));
    return card;
  }
  card.append(element("p", { className: result.scoring.passed ? "pass" : "fail", text: `${result.scoring.passed ? "PASS" : "FAIL"} · ${result.scoring.overallScore}/4` }));
  if (result.scoring.criticalFailures?.length) {
    card.append(element("p", { className: "fail", text: `Critical: ${result.scoring.criticalFailures.join(", ")}` }));
  }
  card.append(element("h3", { text: "Run configuration" }));
  card.append(element("div", {
    className: "evidence",
    text: [
      `Run: ${run.configuration?.runID || "unknown"}`,
      `Requested model: ${run.configuration?.answerModel || "unknown"}`,
      `Returned model: ${result.answer?.model || "unknown"}`,
      `Prompt: ${run.configuration?.promptVersion || "unknown"}`,
      `Evidence: ${run.configuration?.evidenceVersion || "unknown"}`,
      `Retrieval: ${run.configuration?.retrievalVersion || "unknown"}`,
      `Commit: ${run.configuration?.gitCommit || "unknown"}`
    ].join("\n")
  }));
  card.append(element("h3", { text: "Generated answer" }), element("div", { className: "answer", text: answerText(result) }));
  appendList(card, "Returned citations", (result.answer?.citations || []).map((citation) =>
    `${citation.codePrefix} ${citation.sectionNumber} [${citation.sectionID}]: ${citation.relevance}`
  ));
  card.append(element("h3", { text: "Quality scores" }));
  Object.entries(result.scoring.metrics).forEach(([name, metric]) => card.append(element("p", { className: "meta", text: `${name}: ${metric.score}/4 — ${metric.rationale}` })));
  if (result.scoring.deterministic) {
    card.append(element("h3", { text: "Deterministic validation" }));
    card.append(element("div", {
      className: "evidence",
      text: JSON.stringify({
        structuralValidity: result.scoring.deterministic.structuralValidity,
        citationValidation: result.scoring.deterministic.citationValidation,
        operational: result.scoring.deterministic.operational
      }, null, 2)
    }));
  } else {
    card.append(element("p", {
      className: "meta",
      text: `Legacy operational data: ${result.answerTimeMilliseconds || "—"} ms; ${result.answer?.usage?.inputTokens || 0} input tokens; ${result.answer?.usage?.outputTokens || 0} output tokens; estimated answer cost ${result.answer?.estimatedCost?.estimatedUSD ?? result.answer?.estimatedCostUSD ?? "unavailable"}.`
    }));
  }
  if (result.scoring.semantic) {
    card.append(element("h3", { text: "Semantic grader detail" }));
    Object.entries(result.scoring.semantic.metrics || {}).forEach(([name, metric]) => {
      card.append(element("div", {
        className: "evidence",
        text: `${name}: ${metric.score}/4\n${metric.rationale}\nConfidence: ${metric.confidence}; type: ${metric.judgmentType}${metric.failureExcerpt ? `\nFailure excerpt: ${metric.failureExcerpt}` : ""}`
      }));
    });
    [
      ["Required concepts", result.scoring.semantic.rubricChecks?.requiredConcepts],
      ["Forbidden claims", result.scoring.semantic.rubricChecks?.forbiddenClaims],
      ["Missing facts", result.scoring.semantic.rubricChecks?.missingFacts]
    ].forEach(([title, items]) => {
      appendList(card, title, (items || []).map((item) =>
        `${item.id}: ${item.rationale} (${item.confidence}, ${item.judgmentType})${item.failureExcerpt ? ` — ${item.failureExcerpt}` : ""}`
      ));
    });
  }
  appendPreviousReview(card, latestReview("run", caseID, run.configuration.runID));
  card.append(reviewForm(result.testCase, { runID: run.configuration.runID, metrics: result.scoring.metrics }));
  return card;
}

function renderRuns() {
  const section = element("section");
  if (!data.runs.length) {
    section.append(element("article", { className: "card", text: "No paid evaluation run has been saved yet. The runner remains locked until spending is explicitly approved." }));
    panels.runs.replaceChildren(section);
    return;
  }
  const controls = element("div", { className: "compare-controls" });
  const left = element("select");
  const right = element("select");
  data.runs.forEach((run, index) => {
    [left, right].forEach((select) => {
      const option = element("option", { text: runLabel(run) });
      option.value = String(index);
      select.append(option);
    });
  });
  right.value = String(Math.min(1, data.runs.length - 1));
  const caseSelect = element("select");
  data.dataset.cases.filter((item) => item.status === "approved").forEach((testCase) => {
    const option = element("option", { text: testCase.title });
    option.value = testCase.id;
    caseSelect.append(option);
  });
  const grid = element("div", { className: "compare-grid" });
  const redraw = () => grid.replaceChildren(
    runResultCard(data.runs[Number(left.value)], caseSelect.value),
    runResultCard(data.runs[Number(right.value)], caseSelect.value)
  );
  [left, right, caseSelect].forEach((control) => control.addEventListener("change", redraw));
  controls.append(left, right, caseSelect);
  section.append(controls, grid);
  panels.runs.replaceChildren(section);
  redraw();
}

function renderFeedback() {
  const section = element("section", { className: "card" });
  section.append(element("h2", { text: "Feedback candidates" }), element("p", { className: "meta", text: "These records are evidence for review, not proof that an answer was right or wrong. They are never promoted automatically." }));
  if (!data.feedbackCandidates.length) section.append(element("p", { text: "No feedback candidates yet." }));
  data.feedbackCandidates.forEach((feedback) => {
    const item = element("article", { className: "feedback-item evidence" });
    item.append(element("strong", { text: feedback.category.replaceAll("_", " ") }), element("p", { text: feedback.question }), element("p", { className: "meta", text: feedback.userComment || "No written comment." }));
    section.append(item);
  });
  panels.feedback.replaceChildren(section);
}

function renderAll() {
  renderSummary();
  renderCases();
  renderRuns();
  renderFeedback();
  tabs.hidden = false;
  statusElement.hidden = true;
}

async function loadData() {
  try {
    data = await internalRequest("/internal/evaluations/data");
    renderAll();
  } catch (error) {
    statusElement.hidden = false;
    statusElement.classList.add("is-error");
    statusElement.textContent = error.message;
  }
}

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tab]");
  if (!button) return;
  tabs.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  Object.entries(panels).forEach(([name, panel]) => { panel.hidden = name !== button.dataset.tab; });
});

loadData();
