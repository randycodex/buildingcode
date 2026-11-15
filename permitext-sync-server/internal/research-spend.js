const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
};
const integer = value => value == null ? "Unknown" : Number(value).toLocaleString();
const dollars = value => value == null ? "Unknown" : `$${Number(value).toFixed(6)}`;
const cost = row => `${row.costStatus === "partial" ? "≥ " : ""}${dollars(row.estimatedCostUSD)}`;
const totalCost = row => row.requests > 0 && row.unknownCostRequests === row.requests ? "Unknown" :
  `${row.unknownCostRequests || row.partialCostRequests ? "≥ " : ""}${dollars(row.estimatedCostUSD)}`;
const totalTokens = row => row.requests > 0 && row.unknownTokenRequests === row.requests ? "Unknown" :
  `${row.unknownTokenRequests || row.partialTokenRequests ? "≥ " : ""}${integer(row.totalTokens)}`;
const tokenTotal = (row, key) => row.requests > 0 && row.unknownTokenRequests === row.requests ? "Unknown" :
  `${row.unknownTokenRequests || row.partialTokenRequests || (key === "cacheWriteInputTokens" && row.unknownCacheWriteRequests) ? "≥ " : ""}${integer(row[key])}`;

function table(headers, label) {
  const wrapper = node("div", null, "spend-table-scroll");
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", label);
  const el = node("table", null, "spend-table");
  const head = node("thead"), row = node("tr"), body = node("tbody");
  for (const label of headers) { const cell = node("th", label); cell.scope = "col"; row.append(cell); }
  head.append(row); el.append(head, body); wrapper.append(el);
  return { wrapper, body };
}

function select(label, values, selected) {
  const wrapper = node("label", null, "spend-field");
  wrapper.append(node("span", label));
  const input = node("select");
  for (const [value, label] of values) { const option = node("option", label); option.value = value; input.append(option); }
  input.value = selected;
  wrapper.append(input);
  return { wrapper, input };
}

export function renderResearchSpendPanel(panel, report, { loadReport, exportCSV }) {
  const section = node("section", null, "research-spend");
  section.append(node("h2", "Research spend"), node("p",
    "API cost by account, including completed, failed, and cancelled attempts. Dollar amounts are estimates from recorded provider usage and saved pricing. All dates are UTC.", "meta"));
  const applied = { period: report.period || "month", startDate: report.startDate, endDate: report.endDate,
    userID: report.userID || "", status: report.status || "all" };
  const form = node("form", null, "spend-filters");
  const period = select("Date range", [["month", "This month"], ["last-month", "Last month"], ["all", "Lifetime"], ["custom", "Custom dates"]], applied.period);
  const dates = ["Start date", "End date"].map((label, index) => {
    const wrapper = node("label", null, "spend-field"), input = node("input");
    input.type = "date"; input.required = true;
    input.value = index ? report.endDate || "" : report.startDate || "";
    wrapper.append(node("span", label), input);
    return { wrapper, input };
  });
  const account = select("Account", [["", "All accounts"], ...(report.accounts || []).map(row => [row.userID, row.email || row.userID])], applied.userID);
  const outcome = select("Outcome", [["all", "All outcomes"], ["completed", "Completed"], ["failed", "Failed"],
    ["cancelled", "Cancelled"], ["rejected", "Rejected"], ["replayed", "Replayed"], ["unresolved", "Unresolved"]], applied.status);
  const apply = node("button", "Apply filters"); apply.type = "submit";
  form.append(period.wrapper, ...dates.map(date => date.wrapper), account.wrapper, outcome.wrapper, apply);
  const actions = node("div", null, "actions spend-exports");
  const message = node("p", "", "operation-status"); message.setAttribute("role", "status");
  const updateDates = () => dates.forEach(date => { date.input.disabled = period.input.value !== "custom"; });
  updateDates(); period.input.addEventListener("change", updateDates);
  async function busy(action) {
    const controls = [...form.querySelectorAll("input, select, button"), ...actions.querySelectorAll("button")];
    controls.forEach(control => { control.disabled = true; });
    message.classList.remove("is-error"); message.textContent = "Loading…";
    try { await action(); message.textContent = ""; }
    catch (error) { message.classList.add("is-error"); message.textContent = error.message; }
    finally { controls.forEach(control => { control.disabled = false; }); updateDates(); }
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const filters = { period: period.input.value, startDate: dates[0].input.value, endDate: dates[1].input.value,
      userID: account.input.value, status: outcome.input.value };
    busy(() => loadReport(filters));
  });
  for (const view of ["accounts", "requests"]) {
    const button = node("button", `Export ${view} CSV`); button.type = "button";
    button.addEventListener("click", () => busy(() => exportCSV(applied, view)));
    actions.append(button);
  }
  section.append(form, actions, message, node("p", report.period === "all" ? "All recorded history · UTC" :
    `${report.startDate} through ${report.endDate}, inclusive · UTC`, "meta"));
  const totals = report.totals || {}, cards = node("div", null, "summary");
  for (const [label, value] of [["Recorded API cost", totalCost(totals)], ["Accounts", integer(totals.users || 0)],
    ["Request attempts", integer(totals.requests || 0)], ["Total tokens", totalTokens(totals)],
    ["Cost per completed answer¹", dollars(totals.averageCostPerCompletedRequestUSD)]]) {
    const card = node("article"); card.append(node("strong", value), node("span", label)); cards.append(card);
  }
  section.append(cards, node("p", `${integer(totals.completed || 0)} completed · ${integer(totals.failed || 0)} failed · ${integer(totals.cancelled || 0)} cancelled · ${integer(totals.unresolved || 0)} unresolved. ` +
    "¹ Includes the cost of all filtered attempts, divided by completed answers.", "meta"));
  section.append(node("p", "Cached and cache-write tokens are part of input tokens. Query embedding tokens are included in input and total tokens; recorded web-search fees are included in API cost.", "meta"));
  if (report.legacyUnlinkedOperations) section.append(node("p", `${integer(report.legacyUnlinkedOperations)} older completed operation records no longer have a request link. Their usage is counted from the saved usage ledger to avoid counting it twice; some request details are unavailable.`, "meta"));
  if (totals.unknownCostRequests || totals.partialCostRequests || totals.unknownTokenRequests || totals.partialTokenRequests) {
    section.append(node("p", `Attempts with unknown cost: ${integer(totals.unknownCostRequests || 0)}; partial cost: ${integer(totals.partialCostRequests || 0)}. ` +
      `Unknown tokens: ${integer(totals.unknownTokenRequests || 0)}; partial tokens: ${integer(totals.partialTokenRequests || 0)}. ` +
      `Totals marked ≥ include only recorded amounts. Unresolved additional cost allowance: ${dollars(totals.unreconciledCostUpperBoundUSD)}. ` +
      "Historical attempts may lack counters that were never saved. Unfinished reservations remain unresolved until final usage is available; reserved allowances are not recorded cost.", "notice"));
  }
  section.append(node("h3", "Accounts"));
  const accounts = table(["Account", "Attempts", "Completed", "Failed / cancelled", "Input", "Cached input", "Cache writes", "Output", "Total tokens", "API cost", ""], "Account usage and costs");
  for (const item of report.users || []) {
    const row = node("tr");
    for (const value of [item.email || item.userID, integer(item.requests), integer(item.completed),
      `${integer(item.failed)} / ${integer(item.cancelled)}`, tokenTotal(item, "inputTokens"), tokenTotal(item, "cachedInputTokens"),
      tokenTotal(item, "cacheWriteInputTokens"), tokenTotal(item, "outputTokens"), totalTokens(item), totalCost(item)]) row.append(node("td", value));
    const cell = node("td"), button = node("button", "View requests"); button.type = "button";
    button.setAttribute("aria-label", `View requests for ${item.email || item.userID}`);
    button.addEventListener("click", () => busy(() => loadReport({ ...applied, userID: item.userID })));
    cell.append(button); row.append(cell); accounts.body.append(row);
  }
  section.append(accounts.wrapper);
  if (!report.users?.length) section.append(node("p", "No recorded Research attempts match these filters."));
  section.append(node("h3", "Request attempts"));
  const requests = report.requests || [], list = node("div"), pagination = node("div", null, "actions spend-pagination");
  const previous = node("button", "Previous"), next = node("button", "Next"), pageLabel = node("span", "", "meta");
  previous.type = next.type = "button";
  pagination.append(previous, pageLabel, next);
  let page = 0;
  function renderRequests() {
    const results = table(["Date (UTC)", "Account", "Outcome", "Total tokens", "API cost", "Request details"], "Research request attempts");
    for (const item of requests.slice(page * 25, (page + 1) * 25)) {
      const row = node("tr");
      for (const value of [item.createdAt.replace("T", " ").replace(/\.\d+Z$/, ""), item.email || item.userID, item.status,
        `${item.tokenUsageStatus === "partial" ? "≥ " : ""}${integer(item.totalTokens)}`, cost(item)]) row.append(node("td", value));
      const cell = node("td"), details = node("details"), fields = node("dl", null, "spend-request-facts");
      details.append(node("summary", "Details"));
      for (const [label, value] of [["Attempt ID", item.id], ["Usage ID", item.usageID], ["Account ID", item.userID],
        ["Route", item.route], ["Models", item.models?.join(", ") || item.model], ["Pricing version", item.pricingVersion],
        ["Provider attempts", integer(item.providerRequestCount)], ["Unresolved provider attempts", integer(item.pendingProviderRequestCount)],
        ["Input tokens", integer(item.inputTokens)], ["Cached input tokens", integer(item.cachedInputTokens)],
        ["Cache-write tokens", integer(item.cacheWriteInputTokens)], ["Output tokens", integer(item.outputTokens)],
        ["Embedding input tokens", integer(item.embeddingInputTokens)], ["Web searches", integer(item.webSearchCalls)],
        ["Token coverage", item.tokenUsageStatus], ["Cost coverage", item.costStatus],
        ["Unresolved additional cost allowance", dollars(item.unreconciledCostUpperBoundUSD)],
        ["Consumed a Research turn", item.charged ? "Yes" : "No"], ["Funding", item.fundingSource],
        ["Duration", item.durationMilliseconds == null ? "Unknown" : `${item.durationMilliseconds} ms`],
        ["Failure code", item.failureCode], ["Record source", item.source]]) fields.append(node("dt", label), node("dd", value ?? "Not recorded"));
      details.append(fields); cell.append(details); row.append(cell); results.body.append(row);
    }
    list.replaceChildren(results.wrapper);
    previous.disabled = page === 0; next.disabled = (page + 1) * 25 >= requests.length;
    pageLabel.textContent = requests.length ? `${page * 25 + 1}–${Math.min((page + 1) * 25, requests.length)} of ${requests.length} attempts` : "0 attempts";
  }
  previous.addEventListener("click", () => { page--; renderRequests(); });
  next.addEventListener("click", () => { page++; renderRequests(); });
  renderRequests(); section.append(list, pagination);
  panel.replaceChildren(section);
}
