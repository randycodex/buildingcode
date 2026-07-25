import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const port = 8794;
const baseURL = `http://127.0.0.1:${port}`;
const adminToken = "smoke-admin-token";
const grantAdminToken = "smoke-grant-admin-token";
const stripeWebhookSecret = "whsec_smoke";
const userID = "apple:smoke-user";
const defaultSyncCodeVersion = "CodeContent/authored/new-york-city/2022-construction-codes/bundle.json#1";
const zoningSyncCodeVersion = "CodeContent/authored/new-york-city/2026-zoning-resolution/bundle.json#1";
const smokePNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+VnweAAAAAElFTkSuQmCC",
  "base64"
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function mutationKind(mutation) {
  return Object.keys(mutation)[0];
}

function mutationRecord(mutation) {
  return Object.values(mutation)[0];
}

function stripeSignature(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function request(path, { method = "GET", body, token, headers = {}, rawBody } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: rawBody ?? (body ? JSON.stringify(body) : undefined)
  });
  const text = await response.text();
  const json = text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : null;
  return { response, json, text };
}

async function requestBinary(path, { method = "GET", body, token, headers = {}, rawBody } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: rawBody ?? (body ? JSON.stringify(body) : undefined)
  });
  return {
    response,
    body: Buffer.from(await response.arrayBuffer())
  };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const { response } = await request("/health");
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Server did not become ready.");
}

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "permitext-sync-smoke-"));
  const dataPath = join(tempDir, "sync-store.json");
  const privateAssetPath = join(tempDir, "private-assets");
  const evaluationRoot = join(tempDir, "private-evaluations");
  const evaluationResultsPath = join(evaluationRoot, "results");
  const privateEvaluationSentinel = "PERMITEXT_PRIVATE_EVAL_SENTINEL_DO_NOT_EXPOSE";
  await mkdir(evaluationResultsPath, { recursive: true });
  const evaluationDataset = JSON.parse(
    await readFile(new URL("../evals/research-cases.json", import.meta.url), "utf8")
  );
  const evaluationRunCases = evaluationDataset.cases.filter((testCase) => testCase.status === "approved");
  assert(evaluationRunCases.length > 0, "Smoke evaluation fixture needs at least one approved case.");
  evaluationDataset.cases[0].notes = `${evaluationDataset.cases[0].notes} ${privateEvaluationSentinel}`;
  evaluationDataset.cases[0].expectedConclusion =
    `${evaluationDataset.cases[0].expectedConclusion} ${privateEvaluationSentinel}`;
  evaluationDataset.cases[0].requiredConcepts.push(privateEvaluationSentinel);
  evaluationDataset.cases[0].forbiddenClaims.push(privateEvaluationSentinel);
  evaluationDataset.cases[0].missingFacts.push(privateEvaluationSentinel);
  evaluationDataset.cases[0].reviewer = privateEvaluationSentinel;
  const evaluationRunID = "smoke-private-evaluation-run";
  const evaluationRun = {
    schemaVersion: 3,
    status: "completed",
    createdAt: new Date(0).toISOString(),
    configuration: {
      runID: evaluationRunID,
      datasetSHA256: "smoke-private-dataset-hash",
      suiteScope: "full",
      repeat: 1,
      caseIDs: evaluationRunCases.map((testCase) => testCase.id),
      answerModel: "smoke-model",
      promptVersion: "smoke-prompt"
    },
    results: evaluationRunCases.map((testCase) => ({
      repetition: 1,
      testCase,
      answer: {
        conclusion: privateEvaluationSentinel,
        citations: [],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
      },
      scoring: {
        passed: true,
        overallScore: 4,
        metrics: Object.fromEntries(evaluationDataset.automaticScoring.dimensions.map((dimension) => [
          dimension,
          { score: 4, rationale: "Smoke fixture." }
        ]))
      }
    }))
  };
  await writeFile(
    join(evaluationRoot, "research-cases.json"),
    `${JSON.stringify(evaluationDataset, null, 2)}\n`
  );
  await writeFile(
    join(evaluationRoot, "reviews.json"),
    `${JSON.stringify({ schemaVersion: 1, reviews: [] }, null, 2)}\n`
  );
  await writeFile(
    join(evaluationResultsPath, "smoke-run.json"),
    `${JSON.stringify(evaluationRun, null, 2)}\n`
  );
  const workboardSource = await readFile(new URL("../src/workboard.jsx", import.meta.url), "utf8");
  const workboardStyleSource = await readFile(new URL("../src/workboard.css", import.meta.url), "utf8");
  const iosUserDataStoreSource = await readFile(
    new URL("../../NYC CC APP/permitext/Data/UserDataStore.swift", import.meta.url),
    "utf8"
  );
  const iosSyncEngineSource = await readFile(
    new URL("../../NYC CC APP/permitext/Diagnostics/Signposts.swift", import.meta.url),
    "utf8"
  );
  const iosSettingsSource = await readFile(
    new URL("../../NYC CC APP/permitext/Views/SettingsView.swift", import.meta.url),
    "utf8"
  );
  const iosLibraryViewModelSource = await readFile(
    new URL("../../NYC CC APP/permitext/ViewModels/CodeLibraryViewModel.swift", import.meta.url),
    "utf8"
  );
  const iosCodeModelsSource = await readFile(
    new URL("../../NYC CC APP/permitext/Models/CodeModels.swift", import.meta.url),
    "utf8"
  );
  const iosBookmarksSource = await readFile(
    new URL("../../NYC CC APP/permitext/Views/BookmarksView.swift", import.meta.url),
    "utf8"
  );
  const iosExportBuilderSource = await readFile(
    new URL("../../NYC CC APP/permitext/Data/BookmarkExportBuilder.swift", import.meta.url),
    "utf8"
  );
  const iosOrganizationProjectHubSource = await readFile(
    new URL("../../NYC CC APP/permitext/Views/OrganizationProjectHubView.swift", import.meta.url),
    "utf8"
  );
  const syncRepositorySource = await readFile(new URL("../postgres-sync-repository.mjs", import.meta.url), "utf8");
  const serverSource = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
  const researchConfigSource = await readFile(new URL("../research-config.mjs", import.meta.url), "utf8");
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VERCEL: "",
      VERCEL_ENV: "",
      PERMITEXT_SYNC_DATA_PATH: dataPath,
      PERMITEXT_LOCAL_PRIVATE_ASSET_PATH: privateAssetPath,
      PERMITEXT_EVALUATION_ROOT: evaluationRoot,
      PERMITEXT_SYNC_DATABASE_URL: "",
      DATABASE_URL: "",
      STORAGE_URL: "",
      POSTGRES_URL: "",
      NEON_DATABASE_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      VERCEL_OIDC_TOKEN: "",
      BLOB_STORE_ID: "",
      PERMITEXT_SYNC_ADMIN_TOKEN: adminToken,
      PERMITEXT_SYNC_GRANT_ADMIN_TOKEN: grantAdminToken,
      APPLE_TEAM_ID: "ABCDE12345",
      APPLE_BUNDLE_ID: "com.randycodex.permitext",
      APPLE_SERVICE_ID: "com.randycodex.permitext.web",
      PERMITEXT_PUBLIC_BASE_URL: baseURL,
      PERMITEXT_RESEARCH_MOCK: "1",
      PERMITEXT_EVIDENCE_DISCOVERY_BETA: "1",
      STRIPE_WEBHOOK_SECRET: stripeWebhookSecret
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer();

    const aasa = await request("/.well-known/apple-app-site-association");
    assert(aasa.response.ok, "AASA endpoint failed.");
    assert(
      aasa.json.webcredentials.apps.includes("ABCDE12345.com.randycodex.permitext"),
      "AASA payload did not include the configured app identifier."
    );
    assert(
      aasa.json.applinks.details.some((detail) =>
        detail.appID === "ABCDE12345.com.randycodex.permitext" &&
        detail.paths?.includes("/open/section/*")
      ),
      "AASA payload did not advertise section universal links."
    );
    assert(
      aasa.json.applinks.details.some((detail) =>
        detail.appID === "ABCDE12345.com.randycodex.permitext" &&
        detail.components?.some((component) =>
          component["/"] === "/" &&
          component["?"]?.organizationInvite === "*"
        )
      ),
      "AASA payload did not advertise organization invitation universal links."
    );

    const webRoot = await request("/");
    assert(webRoot.response.ok, "Web root did not load.");
    assert(webRoot.response.headers.get("content-type")?.includes("text/html"), "Web root did not return HTML.");
    assert(webRoot.response.headers.get("x-content-type-options") === "nosniff", "Web root omitted security headers.");
    assert(webRoot.response.headers.get("content-security-policy")?.includes("script-src"), "Web root omitted its CSP.");
    assert(!webRoot.text.includes("reader-share"), "Web reader unexpectedly included its retired section share control.");
    assert(webRoot.text.includes('aria-label="AI-assisted research"'), "Web workspace omitted its research tool or trust label.");
    assert(!webRoot.text.includes('id="workboard-dock"'), "Web workspace still included the retired fixed Workboard dock.");
    assert(
      webRoot.text.includes("20260725-firm-controls-v10"),
      "Web workspace omitted the current package asset version."
    );
    assert(
      !webRoot.text.includes(privateEvaluationSentinel),
      "Customer HTML exposed private evaluation material."
    );
    const topbarSource = webRoot.text.slice(
      webRoot.text.indexOf('<header class="topbar">'),
      webRoot.text.indexOf("</header>")
    );
    const topbarGroupOrder = [
      'aria-label="Read and find"',
      'aria-label="Your workspace"',
      'aria-label="Research and preferences"',
      'aria-label="Workspace layout"',
      'class="topbar-brand"'
    ].map((marker) => topbarSource.indexOf(marker));
    assert(
      topbarGroupOrder.every((index, position) => index >= 0 && (position === 0 || index > topbarGroupOrder[position - 1])),
      "Web topbar tools are no longer logically grouped on the left with the brand on the right."
    );
    const settingsTemplateSource = webRoot.text.slice(
      webRoot.text.indexOf('<template id="settings-template"'),
      webRoot.text.indexOf('<script src="/web/app.js')
    );
    const settingsSectionOrder = [
      '>Code Preferences</h3>',
      '>Plan</h3>',
      '>Account</h3>',
      '>Sync</h3>',
      '>Data &amp; Storage</h3>',
      '>Projects</h4>'
    ].map((marker) => settingsTemplateSource.indexOf(marker));
    assert(
      settingsSectionOrder.every((index, position) => index >= 0 && (position === 0 || index > settingsSectionOrder[position - 1])),
      "Web Settings groups do not match the iOS Settings order."
    );
    assert(
      !settingsTemplateSource.includes("Destructive Actions") &&
        !settingsTemplateSource.includes("Changes apply to the current code data and synced devices."),
      "Web Settings restored the redundant destructive-actions heading or helper copy."
    );
    assert(
      settingsTemplateSource.includes('>Reader Font</span>') &&
        settingsTemplateSource.indexOf('class="preview-font-family-select"') < settingsTemplateSource.indexOf('>Plan</h3>') &&
        !settingsTemplateSource.includes('class="reader-preview-card settings-card"'),
      "Web Settings no longer keeps Reader Font with the top preferences or restored the redundant preview card."
    );
    assert(
      !settingsTemplateSource.includes("Public username") &&
        !settingsTemplateSource.includes("account-profile-editor") &&
        !settingsTemplateSource.includes("account-profile-save") &&
        !settingsTemplateSource.includes("account-summary") &&
        !settingsTemplateSource.includes("All browser changes are synced."),
      "Web Settings exposed reserved profile controls or redundant account and sync copy."
    );
    ["Clear Recent Searches", "Clear All Bookmarks", "Clear All Notes", "Clear All Tags"].forEach((label) => {
      assert(settingsTemplateSource.includes(label), `Web Settings omitted ${label}.`);
    });
    assert(
      settingsTemplateSource.includes('class="settings-project-list"') &&
        settingsTemplateSource.includes('class="settings-link-button settings-project-select-all"') &&
        settingsTemplateSource.includes('class="settings-secondary-button settings-project-delete"'),
      "Web Settings omitted project selection or bulk deletion controls."
    );
    assert(
      settingsTemplateSource.includes('data-plan-option="free"') &&
        settingsTemplateSource.includes('data-plan-option="pro"') &&
        !settingsTemplateSource.includes('class="settings-billing-line"'),
      "Web Settings lost active-plan styling or restored the redundant billing summary."
    );
    assert(
      !settingsTemplateSource.includes("Comparison Mode") &&
        !settingsTemplateSource.includes("settings-comparison-toggle"),
      "Web Settings still includes the retired Comparison Mode control."
    );
    assert(
      !settingsTemplateSource.includes("preview-font-slider") &&
        !settingsTemplateSource.includes("preview-spacing-slider") &&
        !settingsTemplateSource.includes("Font Size") &&
        !settingsTemplateSource.includes("Line Spacing"),
      "Web Settings still includes the retired Reader Preview sliders."
    );
    assert(
      webRoot.text.includes('class="reader-spacing-controls"') &&
        webRoot.text.includes('class="reader-typography-toggle"') &&
        webRoot.text.includes('class="reader-typography-tools" hidden') &&
        webRoot.text.includes('aria-label="Decrease Reader line spacing"') &&
        webRoot.text.includes('aria-label="Increase Reader line spacing"'),
      "Reader headers omitted their line-spacing controls."
    );
    assert(
      webRoot.text.includes('class="reader-internal-search search-box"') &&
        webRoot.text.includes('class="reader-internal-search-input search-input"') &&
        webRoot.text.includes('class="reader-internal-search-clear search-clear-button"'),
      "Reader search no longer shares the Search column field treatment."
    );

    const workspaceScript = await request("/web/app.js");
    const syncStateScript = await request("/web/sync-state.js");
    const evidenceDiscoveryClientSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("function renderEvidenceDiscovery"),
      workspaceScript.text.indexOf("async function renderResearch")
    );
    assert(workspaceScript.response.ok, "Web workspace script did not load.");
    assert(
      workspaceScript.text.includes('row.classList.toggle("is-active", active)') &&
        workspaceScript.text.includes('checkoutButton.textContent = pro') &&
        workspaceScript.text.includes('? "Pro Active" : "Manage Subscription"') &&
        workspaceScript.text.includes(': "Upgrade to Pro"'),
      "Web Settings no longer distinguishes active Free and Pro plan actions."
    );
    assert(
      workspaceScript.response.headers.get("content-type")?.includes("javascript"),
      "Web workspace script returned the wrong content type."
    );
    assert(
      workspaceScript.text.includes('{ prefix: "ZR", label: "Zoning Resolution", theme: "zoning" }') &&
        workspaceScript.text.includes("syncCodeVersionForPrefix") &&
        workspaceScript.text.includes('toUpperCase() === "ZR"'),
      "Web workspace omitted the Zoning Resolution library or its Research exclusion."
    );
    assert(
      workspaceScript.response.headers.get("cache-control")?.includes("immutable"),
      "Versioned web workspace assets were not browser-cacheable."
    );
    assert(
      !workspaceScript.text.includes(privateEvaluationSentinel),
      "Customer JavaScript exposed private evaluation material."
    );
    assert(
      webRoot.text.includes("Firm &amp; Collaboration") &&
        webRoot.text.includes('class="settings-beta-badge"') &&
        workspaceScript.text.includes('postResearch("/organizations/create"') &&
        workspaceScript.text.includes('postResearch("/organizations/members/invite"') &&
        workspaceScript.text.includes('postResearch("/organizations/projects/snapshot"') &&
        workspaceScript.text.includes("function appendProjectEvidenceReviews") &&
        workspaceScript.text.includes("function appendProjectNotes") &&
        workspaceScript.text.includes("function appendProjectReviewThreads") &&
        workspaceScript.text.includes('postResearch("/projects/collaboration/notes/save"') &&
        workspaceScript.text.includes('postResearch("/projects/collaboration/threads/save"') &&
        workspaceScript.text.includes('postResearch("/projects/collaboration/comments/save"') &&
        workspaceScript.text.includes("function appendProjectReportExports") &&
        workspaceScript.text.includes("if (identity.sharedOnly) row.classList.add(\"is-read-only\")"),
      "Web collaboration UI no longer exposes firm setup, scoped Project access, evidence review, and report downloads."
    );
    const workspaceSourceMap = await request("/web/app.js.map");
    assert(
      !workspaceSourceMap.text.includes(privateEvaluationSentinel),
      "A customer source-map response exposed private evaluation material."
    );
    const directEvaluationFile = await request("/evals/research-cases.json");
    assert(
      !directEvaluationFile.response.ok &&
        !directEvaluationFile.text.includes(privateEvaluationSentinel),
      "The customer static root exposed the server-private evaluation dataset."
    );
    assert(
      !workspaceScript.text.includes('appendSectionLabel(content, "Saved sections")'),
      "Saved pane still included its retired Saved sections heading."
    );
    assert(
      !workspaceScript.text.includes("synchronizeComparisonReaders") &&
        !workspaceScript.text.includes("comparisonModeEnabled") &&
        !workspaceScript.text.includes("comparisonReaderID") &&
        workspaceScript.text.includes("!reader.comparisonManaged"),
      "Web workspace still includes retired Comparison Mode behavior."
    );
    assert(
      !workspaceScript.text.includes("wireReaderSettingsControls") &&
        !workspaceScript.text.includes("readerLineHeightValue") &&
        !workspaceScript.text.includes("readerSettings.fontSize") &&
        !workspaceScript.text.includes("readerSettings.lineSpacing") &&
        workspaceScript.text.includes("function wireReaderFontFamilyControl"),
      "Web workspace still includes retired Reader Preview slider behavior."
    );
    assert(
      !workspaceScript.text.includes('appendSectionLabel(content, "Notes and tags")'),
      "Saved column still renders the removed Notes and tags label."
    );
    assert(
      !workspaceScript.text.includes('appendSectionLabel(content, "Saved items")'),
      "Saved column still renders the removed Saved items label."
    );
    const projectsTemplateSource = webRoot.text.slice(
      webRoot.text.indexOf('<template id="projects-template"'),
      webRoot.text.indexOf('<template id="search-template"')
    );
    const searchTemplateSource = webRoot.text.slice(
      webRoot.text.indexOf('<template id="search-template"'),
      webRoot.text.indexOf('<template id="saved-template"')
    );
    const savedTemplateSource = webRoot.text.slice(
      webRoot.text.indexOf('<template id="saved-template"'),
      webRoot.text.indexOf('<template id="analysis-template"')
    );
    assert(
      savedTemplateSource.includes('aria-label="Sort saved sections"') &&
        savedTemplateSource.includes('aria-label="Export saved sections as PDF"') &&
        savedTemplateSource.includes('class="saved-projects-section"') &&
        savedTemplateSource.includes('class="saved-project-pages"') &&
        savedTemplateSource.includes('class="saved-project-page-dots"') &&
        savedTemplateSource.includes('aria-label="Add project"') &&
        savedTemplateSource.includes('class="saved-code-filter"') &&
        savedTemplateSource.includes('class="saved-tag-filter"') &&
        savedTemplateSource.indexOf('class="saved-projects-section"') < savedTemplateSource.indexOf('class="saved-inline-filters"') &&
        savedTemplateSource.indexOf('class="saved-inline-filters"') < savedTemplateSource.indexOf('class="saved-content"') &&
        !topbarSource.includes('id="toggle-projects"') &&
        !savedTemplateSource.includes('aria-label="Saved text size"') &&
        !projectsTemplateSource.includes('aria-label="Saved text size"'),
      "Saved and Projects no longer follow the combined iOS hierarchy."
    );
    assert(
      workspaceScript.text.includes("function renderSavedProjects(panel, paneID, projects, projectSections)") &&
        workspaceScript.text.includes("function projectForegroundColor(color)") &&
        workspaceScript.text.includes('tile.style.setProperty("--project-on-color", projectForegroundColor(tileColor))') &&
        workspaceScript.text.includes("projectPages.push(visibleProjects.slice(index, index + 4))") &&
        workspaceScript.text.includes("openProjectDetail(project, { sourcePaneID: paneID })") &&
        !workspaceScript.text.includes("panes.push(await renderProjects())"),
      "Combined Saved no longer owns the project grid and project-detail flow."
    );
    assert(
      workspaceScript.text.includes("async function activateProjectStudio(project, options = {})") &&
        workspaceScript.text.includes("state.notebooks = keepNotebookOpen ? [identity] : []") &&
        workspaceScript.text.includes("state.workboards = keepWorkboardOpen ? [identity] : []") &&
        workspaceScript.text.includes("state.reportDrafts = keepReportDraftOpen ? [identity] : []") &&
        workspaceScript.text.includes("confirmDiscardIfNeeded()") &&
        workspaceScript.text.includes("Discard unsaved Report Draft changes?") &&
        workspaceScript.text.includes("This active Project controls every Project-specific workspace.") &&
        workspaceScript.text.includes("function printReportManifestAsPDF(manifest)") &&
        workspaceScript.text.includes("function renderFirmStandardsEditor") &&
        workspaceScript.text.includes('postResearch("/organizations/controls/save"') &&
        workspaceScript.text.includes('postResearch("/reports/options"') &&
        workspaceScript.text.includes("reportTemplateID: selectedReportTemplateID") &&
        workspaceScript.text.includes("async function downloadProjectReportFile") &&
        workspaceScript.text.includes('fetch("/reports/files/read"') &&
        workspaceScript.text.includes("No immutable Research answers are linked to this Project yet."),
      "Web Project Studio no longer switches its Project overview, Notebook, Research history, Report Draft, and Workboard as one guarded workspace."
    );
    assert(
      iosSyncEngineSource.includes("async let foundation = transport.projectFoundation") &&
        iosSyncEngineSource.includes("async let notebook = transport.projectNotebookCards") &&
        iosSyncEngineSource.includes("async let reports = transport.projectReportHistory") &&
        iosCodeModelsSource.includes('post("projects/foundation/state"') &&
        iosCodeModelsSource.includes('post("notebook/cards/list"') &&
        iosCodeModelsSource.includes('post("reports/history/list"') &&
        iosCodeModelsSource.includes('post("reports/manifests/get"') &&
        iosCodeModelsSource.includes('appendingPathComponent("reports/files/upload")') &&
        iosCodeModelsSource.includes('appendingPathComponent("workboards/previews/read")') &&
        iosSyncEngineSource.includes("func saveProjectReportPDF") &&
        iosSyncEngineSource.includes("func projectWorkboardPreview(") &&
        iosLibraryViewModelSource.includes("func projectHubSnapshot(folderID: Int64)") &&
        iosLibraryViewModelSource.includes("func projectReportPDF(manifestID: String)") &&
        iosLibraryViewModelSource.includes("func projectWorkboardPreviewData(") &&
        iosLibraryViewModelSource.includes("SHA256.hash(data: data)") &&
        iosLibraryViewModelSource.includes("saveProjectReportPDF") &&
        iosBookmarksSource.includes('CodeEyebrow(text: "Project Hub"') &&
        iosBookmarksSource.includes('projectHubSection(title: "Notebook"') &&
        iosBookmarksSource.includes('projectHubSection(title: "Research History"') &&
        iosBookmarksSource.includes('projectHubSection(title: "Exports"') &&
        iosExportBuilderSource.includes("struct ProjectReportExportBuilder: Sendable") &&
        iosCodeModelsSource.includes("struct PermitextFirmControls: Codable") &&
        iosCodeModelsSource.includes("struct ProjectReportPresentation: Codable") &&
        iosExportBuilderSource.includes("reportCoverLabel") &&
        iosExportBuilderSource.includes("reportBrandName") &&
        iosOrganizationProjectHubSource.includes('projectSection(title: "Firm context"') &&
        iosOrganizationProjectHubSource.includes("assignedFirmTags") &&
        iosExportBuilderSource.includes("manifest.contentHash") &&
        iosBookmarksSource.includes("Create & Save iOS PDF") &&
        iosBookmarksSource.includes('"Read-only preview"') &&
        iosBookmarksSource.includes("Flattened Project Workboard preview") &&
        iosBookmarksSource.includes("Workboard editing stays on the web."),
      "iOS Project Hub no longer provides its read-only Notebook, immutable Research, native Report export, and web-first Workboard contract."
    );
    assert(
      iosLibraryViewModelSource.includes("private var startupWarmupTask: Task<Void, Never>?") &&
        iosLibraryViewModelSource.includes("startupWarmupTask?.cancel()") &&
        Array.from(iosLibraryViewModelSource.matchAll(
          /self\.isInitialContentLoaded = true\s+self\.startupWarmupTask = Task/g
        )).length === 2,
      "iOS startup once again blocks first paint on authored or SQLite content prewarming."
    );
    const projectMutationSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("function projectMutationForRecord"),
      workspaceScript.text.indexOf("function deletedProjectMutationForRecord")
    );
    const projectUpdateSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("async function updateProjectFolder"),
      workspaceScript.text.indexOf("async function archiveProject")
    );
    const projectArchiveSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("async function archiveProject"),
      workspaceScript.text.indexOf("async function deleteArchivedProject")
    );
    assert(
      projectMutationSource.includes("colorHex: color") &&
        projectUpdateSource.includes("colorHex: color") &&
        !projectMutationSource.includes("project.colorHex || color") &&
        !projectUpdateSource.includes("project.colorHex || color"),
      "Project color edits can still send a stale colorHex to another device."
    );
    assert(
      projectMutationSource.includes("archivedAt: project.archivedAt || null") &&
        projectArchiveSource.includes("await pushMutation(projectMutationForRecord(project, account))") &&
        projectArchiveSource.includes("archivedAt: null") &&
        workspaceScript.text.includes("async function migrateLegacyArchivedProjects()") &&
        workspaceScript.text.includes("if (await migrateLegacyArchivedProjects())"),
      "Project archive and restore state no longer syncs or migrates from legacy browser storage."
    );
    assert(
      !workspaceScript.text.includes("if (popup.closed) void reattachProjectWorkboard(identity)"),
      "Detached Workboards still auto-reattached from an unreliable popup.closed check."
    );
    assert(
      workspaceScript.text.includes("?v=${workboardClientVersion}"),
      "Published code images no longer receive a content-version cache key."
    );
    assert(
      workspaceScript.text.includes("createProjectBulkSelectionController") &&
        workspaceScript.text.includes("await archiveProjects(selectedProjects)") &&
        workspaceScript.text.includes("await deleteArchivedProjects(selectedProjects)") &&
        workspaceScript.text.includes('deleteButton.textContent = `Delete ${selectedCount}`') &&
        workspaceScript.text.includes("membershipTombstones.forEach((record) => enqueueSyncMutation({ projectSection: record }, account))") &&
        workspaceScript.text.includes("const deletedIDs = new Set()") &&
        workspaceScript.text.includes("This cannot be undone."),
      "Project panes omitted their shared bulk archive/delete selection flow."
    );
    assert(
      workspaceScript.text.includes("function recoverQueuedWorkboardProjectID") &&
        workspaceScript.text.includes("function prepareSyncOutboxForFlush") &&
        workspaceScript.text.includes("prepareSyncOutboxForFlush(account);") &&
        workspaceScript.text.includes("Workboard sync paused because its project identity is missing."),
      "Invalid legacy Workboard mutations can still block unrelated project-item deletions."
    );
    assert(
      !workspaceScript.text.includes("track.replaceChildren(...nodes)"),
      "Column transitions still detach and reattach the complete workspace."
    );
    assert(
      workspaceScript.text.includes("window.requestAnimationFrame(applyPendingResize)"),
      "Divider resizing is no longer coalesced to animation frames."
    );
    assert(
      workspaceScript.text.includes("const foregroundSyncIntervalMilliseconds = 30_000") &&
        workspaceScript.text.includes("function canRunForegroundSync()") &&
        workspaceScript.text.includes('document.visibilityState === "visible"') &&
        workspaceScript.text.includes("navigator.onLine") &&
        workspaceScript.text.includes("async function performForegroundSync()") &&
        workspaceScript.text.includes("await loadSyncedContent({ force: true, skipOutbox: true })") &&
        workspaceScript.text.includes('window.addEventListener("offline"') &&
        workspaceScript.text.includes("startForegroundSyncLoop({ immediate: true })"),
      "Visible web tabs no longer perform incremental foreground sync every 30 seconds."
    );
    assert(
      workspaceScript.text.includes("const webFreePlanLimits = Object.freeze({ savedItems: 25, notes: 10 })") &&
        workspaceScript.text.includes("function presentPlanLimitNotice(title, message)") &&
        workspaceScript.text.includes("Free saved-section limit reached") &&
        workspaceScript.text.includes("Free note limit reached") &&
        workspaceScript.text.includes("Tags require Pro") &&
        workspaceScript.text.includes("Projects require Pro") &&
        workspaceScript.text.includes("PDF export requires Pro") &&
        workspaceScript.text.includes("Workboards require Pro") &&
        serverSource.includes("Workboard image uploads require Pro.") &&
        syncRepositorySource.includes("lower(plan) = 'pro'"),
      "Free and Pro capabilities are no longer enforced consistently by the web UI and server."
    );
    assert(
      syncStateScript.response.ok &&
        syncStateScript.text.includes("function bulkClearScope(record)") &&
        syncStateScript.text.includes("function bulkClearEventID(clearRecords, codeVersion, scope)") &&
        syncStateScript.text.includes("function recordSurvivesBulkClear(record, clearRecords, scopes)") &&
        syncStateScript.text.includes("!Number.isFinite(updatedAt) || clearedAt >= updatedAt") &&
        workspaceScript.text.includes('recordSurvivesBulkClear(record, codeVersionClears, ["bookmarks"])') &&
        workspaceScript.text.includes('"localBulkClears"') &&
        workspaceScript.text.includes("...(state.localBulkClears || [])") &&
        workspaceScript.text.includes("annotationAfterBulkClears(item, clearRecords)") &&
        workspaceScript.text.includes("A legacy queued change could not be reconciled and was paused.") &&
        workspaceScript.text.includes("function absorbBulkClearConflicts()") &&
        workspaceScript.text.includes('bulkClearTimestamp(clearRecords, record.codeVersion, "notes")') &&
        workspaceScript.text.includes('bulkClearTimestamp(clearRecords, record.codeVersion, "tags")') &&
        workspaceScript.text.includes("syncProjectIdentity(detail.clientID, detail.userID)") &&
        workspaceScript.text.includes("saved.browserCredentialID") &&
        workspaceScript.text.includes('const accountSessionKey = "permitext:webAccount:v1"') &&
        workspaceScript.text.includes('const tabWorkspaceKey = "permitext:webWorkspaceTab:v1"') &&
        workspaceScript.text.includes("sessionStorage.setItem(tabWorkspaceKey") &&
        workspaceScript.text.includes("persistAccountSession(null)") &&
        workspaceScript.text.includes("recentSearchesJSON"),
      "Web foreground sync no longer applies iOS bulk clears or recent-search continuity."
    );
    assert(
      iosUserDataStoreSource.includes("pendingBulkClearUpdatedAt(for: localizedMutation)") &&
        iosSyncEngineSource.includes("removingFieldsSuperseded(by: bulkClears)") &&
        iosSyncEngineSource.includes('supersededScopes.contains("notes")') &&
        iosSyncEngineSource.includes('supersededScopes.contains("tags")'),
      "iOS sync no longer protects newer collection clears from stale full-pull records."
    );
    const webContinuitySource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("async function applyRemoteContinuityIfNewer"),
      workspaceScript.text.indexOf("function enqueueSyncMutation")
    );
    const iosContinuitySource = iosSyncEngineSource.slice(
      iosSyncEngineSource.indexOf("private func applyServerContinuity"),
      iosSyncEngineSource.indexOf("private extension Array")
    );
    const iosRefreshContinuitySource = iosLibraryViewModelSource.slice(
      iosLibraryViewModelSource.indexOf("private func refreshContinuityStateFromStore"),
      iosLibraryViewModelSource.indexOf("#if DEBUG", iosLibraryViewModelSource.indexOf("private func refreshContinuityStateFromStore"))
    );
    assert(
      !webContinuitySource.includes("state.settingsCodePrefix =") &&
        !webContinuitySource.includes("readerFieldsForSectionDetail") &&
        !webContinuitySource.includes("lastOpenedChapterID") &&
        iosContinuitySource.includes("selectedVersionFileName: existingContext.selectedVersionFileName") &&
        iosContinuitySource.includes("selectedCodeSectionID: existingContext.selectedCodeSectionID") &&
        iosContinuitySource.includes("activeProjectID: existingContext.activeProjectID") &&
        !iosRefreshContinuitySource.includes("openSelectedContent()"),
      "Remote continuity can still steer another device's active reader, code version, or project."
    );
    assert(
      iosUserDataStoreSource.includes("private func folderSectionSyncTargets") &&
        iosUserDataStoreSource.includes('values: ["folderClientID": target.folderClientID]') &&
        iosUserDataStoreSource.includes("let sectionIDs = try sectionIDs(inFolder: id, codeVersion: codeVersion)") &&
        !iosUserDataStoreSource.includes('values: ["scope": "allFolders"]'),
      "iOS project membership removals are no longer durable project-specific tombstones."
    );
    assert(
      iosSettingsSource.includes("private var projectManagementCard") &&
        iosSettingsSource.includes('selectedProjectIDs = Set(library.folders.map(\\.id))') &&
        iosSettingsSource.includes("showsProjectDeleteWarning = true") &&
        iosSettingsSource.includes("library.deleteFolders(ids: selectedProjectIDs)") &&
        iosLibraryViewModelSource.includes("func deleteFolders(ids: Set<Int64>) -> Set<Int64>"),
      "iOS Settings omitted project selection, Select All, warning, or bulk deletion."
    );
    assert(
      workspaceScript.text.includes("const hasManyColumns = ids.length >= 4") &&
        workspaceScript.text.includes("Math.max(value, defaultWidth)") &&
        workspaceScript.text.includes('panel.style.setProperty("--pane-default-min-width"'),
      "Four-or-more-column workspaces no longer enforce every pane's default width."
    );
    assert(
      workspaceScript.text.includes("minWidth: defaultPaneWidthForID(pane.dataset.paneId)") &&
        workspaceScript.text.includes("const pushedScrollDelta = appliedPreviousDelta - delta") &&
        workspaceScript.text.includes("startScrollLeft + pushedScrollDelta"),
      "Divider resizing no longer preserves default widths while pushing the workspace under the pointer."
    );
    assert(
      workspaceScript.text.includes("paneIDForSectionDetail(searchID),"),
      "Search result changes no longer refresh their existing section-detail column."
    );
    assert(
      !workspaceScript.text.includes('notesTitle.textContent = "Notes"'),
      "Section details still render the retired Notes heading."
    );
    assert(
      workspaceScript.text.includes("const identity = projectDetailKey(project);"),
      "Project cards no longer deduplicate local and synced records by their stable identity."
    );
    assert(
      !workspaceScript.text.includes('title: "Share section"') &&
        !workspaceScript.text.includes("function shareIconSVG()"),
      "Section details still include their retired share control."
    );
    assert(
      workspaceScript.text.includes("chrome.append(saveButton, backButton)") &&
        workspaceScript.text.includes('label: "Close saved item"'),
      "Saved-item details no longer place the bookmark on the left and close control on the right."
    );
    assert(
      workspaceScript.text.includes("alignReaderSectionAfterLayout(reader);") &&
        workspaceScript.text.includes("const anchorRect = panel?.getBoundingClientRect() || contentRect;"),
      "Linked Readers no longer align selected sections below their headers after layout."
    );
    assert(
      !workspaceScript.text.includes("search-result-limit") &&
        !workspaceScript.text.includes("Narrow the search for more specific results."),
      "Search results still include the retired capped-results notice."
    );
    assert(
      !workspaceScript.text.includes('activeReaderButton') &&
        !workspaceScript.text.includes('Open in reader') &&
        !workspaceScript.text.includes('Open Section ${detail.sectionNumber} in active reader') &&
        !workspaceScript.text.includes('function openSearchResultInReader') &&
        !workspaceScript.text.includes('function openSearchResultInNewReader') &&
        !workspaceScript.text.includes('newReaderButton') &&
        !workspaceScript.text.includes('New reader') &&
        workspaceScript.text.includes('openSectionDetail(searchInstance.id, detail);') &&
        workspaceScript.text.includes("function updateSearchDock") &&
        workspaceScript.text.includes('summaryCopy.textContent = `${resultCount.toLocaleString()}'),
      "Search results restored a retired Reader action or omitted their row-level detail action and count."
    );
    assert(
      workspaceScript.text.includes("function renderSearchHistory") &&
        workspaceScript.text.includes('label.textContent = "Jump Back In"') &&
        workspaceScript.text.includes('appendHistorySection("Pinned"') &&
        workspaceScript.text.includes('appendHistorySection("Recent Searches"') &&
        workspaceScript.text.includes("function recordRecentSearch") &&
        workspaceScript.text.includes("function pinSearch") &&
        workspaceScript.text.includes("function removeRecentSearch") &&
        searchTemplateSource.indexOf('class="panel-header"') < searchTemplateSource.indexOf('class="search-box"') &&
        searchTemplateSource.indexOf('class="search-box"') < searchTemplateSource.indexOf('class="search-result-summary"') &&
        searchTemplateSource.indexOf('class="search-result-summary"') < searchTemplateSource.indexOf('class="search-code-filter"') &&
        searchTemplateSource.indexOf('class="search-code-filter"') < searchTemplateSource.indexOf('class="search-results"'),
      "Search field no longer sits below the column title and above the summary, filters, and results."
    );
    assert(
      workspaceScript.text.includes("const savedFilterScrollPositions = new Map();") &&
        workspaceScript.text.includes("savedFilterScrollPositions.set(instance.id") &&
        workspaceScript.text.includes("const savedFilterScroll = savedFilterScrollPositions.get(savedInstance.id);") &&
        workspaceScript.text.includes("requestAnimationFrame(restoreFilterScroll);"),
      "Saved filter menus no longer preserve their horizontal position after selection."
    );
    assert(
      workspaceScript.text.includes("function linkInlineCodeReferences") &&
        workspaceScript.text.includes("function openInlineCodeReference") &&
        workspaceScript.text.includes("function openReferenceInAdjacentReader") &&
        workspaceScript.text.includes("placePaneAfter(paneIDForReader(sourceReader), paneIDForReader(targetReader))") &&
        workspaceScript.text.includes("inlineCodeReferencePhrases(text)") &&
        workspaceScript.text.includes('./code-references.js?v=20260720-code-reference-links-v18') &&
        workspaceScript.text.includes('./sync-state.js?v=20260721-causal-clear-v4') &&
        !workspaceScript.text.includes("const savedCount = settingsProjectSections") &&
        !workspaceScript.text.includes('swatch.className = "settings-project-swatch"') &&
        workspaceScript.text.includes("name.textContent = readableProjectName(project)") &&
        workspaceScript.text.includes("function researchSelectionTextFromRange") &&
        workspaceScript.text.includes("function renderResearchProjectContext") &&
        workspaceScript.text.includes("function renderHistoricalResearchRecord") &&
        workspaceScript.text.includes('postResearch("/research/conversations/reuse-evidence"') &&
        workspaceScript.text.includes("Project facts are user-provided context only") &&
        workspaceScript.text.includes('researchSavedItemID: item.savedColumnKind === "bookmark" ? item.id : ""') &&
        workspaceScript.text.includes('data-research-selection-exclude="true"') &&
        webRoot.text.includes('/web/app.js?v=20260725-firm-controls-v10'),
      "Reader citations no longer preserve range text or open in an adjacent Reader."
    );
    assert(
      evidenceDiscoveryClientSource.includes('postResearch("/research/evidence/discover"') &&
        evidenceDiscoveryClientSource.includes("Candidate · not approved") &&
        evidenceDiscoveryClientSource.includes("Approve") &&
        evidenceDiscoveryClientSource.includes("Reject") &&
        evidenceDiscoveryClientSource.includes("Prepare Approved Evidence") &&
        evidenceDiscoveryClientSource.includes('postResearch("/research/conversations/create"') &&
        evidenceDiscoveryClientSource.includes('postResearch("/research/conversations/evidence"') &&
        !evidenceDiscoveryClientSource.includes('postResearch("/research/conversations/message"'),
      "The Evidence Tray no longer preserves explicit candidate review before Research analysis."
    );
    assert(
        workspaceScript.text.includes('const summarySavedItems = (summary.savedItems || [])') &&
        workspaceScript.text.includes('.filter((item) => recordSurvivesBulkClear(item, clearRecords, ["bookmarks"]))') &&
        workspaceScript.text.includes('.map((item) => annotationAfterBulkClears(item, clearRecords))') &&
        workspaceScript.text.includes('.filter((item) => recordSurvivesBulkClear(item, clearRecords, ["bookmarks", "folders"]))'),
      "Cached remote data can bypass durable cross-device clears."
    );
    assert(
      workspaceScript.text.includes("const foregroundSyncJitterMilliseconds = 3_000;") &&
        workspaceScript.text.includes("Math.round((Math.random() * 2 - 1) * foregroundSyncJitterMilliseconds)") &&
        syncRepositorySource.includes("AND records.entity_kind = 'project'") &&
        syncRepositorySource.includes("allMutations: [...filteredRows, ...dependencyRows]") &&
        serverSource.includes("permitext_sync_events_user_record_event_idx"),
      "Foreground sync no longer spreads polling load or performs incremental dependency reads."
    );
    assert(
      workspaceScript.text.includes("function openWorkspaceCommandPalette") &&
        workspaceScript.text.includes('event.key.toLowerCase() === "k"') &&
        workspaceScript.text.includes('event.key.toLowerCase() === "f"'),
      "Web workspace keyboard navigation or command palette is missing."
    );
    assert(
      workspaceScript.text.includes('const internalSectionHistoryStateKey = "permitextInternalSectionNavigation"') &&
        workspaceScript.text.includes("function sectionRouteIDFromLocation") &&
        workspaceScript.text.includes("function pageLoadedFromRefresh") &&
        workspaceScript.text.includes("function consumeBrowserSectionURL") &&
        workspaceScript.text.includes("const persistableState = {") &&
        workspaceScript.text.includes("sectionDetails: {},") &&
        workspaceScript.text.includes('!paneID.startsWith("section:detail:")') &&
        workspaceScript.text.includes("const deepLinkedSectionID = deepLinkedSectionIDFromLocation();") &&
        workspaceScript.text.includes("consumeBrowserSectionURL();") &&
        workspaceScript.text.includes("if (organizationInvitationTokenFromURL())") &&
        workspaceScript.text.includes("await renderWorkspace();"),
      "Search-result detail columns can persist or replay after a browser refresh."
    );
    assert(
      workspaceScript.text.includes("function openWebWarning") &&
        workspaceScript.text.includes("function confirmWebWarning") &&
        workspaceScript.text.includes("function showWebNotice") &&
        workspaceScript.text.includes('dialog.setAttribute("role", "alertdialog")') &&
        workspaceScript.text.includes('dialog.setAttribute("aria-modal", "true")') &&
        workspaceScript.text.includes('confirmButton.className = "web-warning-button web-warning-confirm"') &&
        !workspaceScript.text.includes("window.confirm(") &&
        !workspaceScript.text.includes("window.alert("),
      "Web warnings no longer share the Clear canvas confirmation-dialog pattern."
    );
    assert(
      workspaceScript.text.includes('trustHeading.textContent = "AI-assisted research — not an official interpretation"') &&
        !workspaceScript.text.includes('noteLabel.textContent = "Private note · not code text"'),
      "Research trust labeling or the simplified private-note header regressed."
    );
    assert(
      workspaceScript.text.includes("function bindResearchTextSelection") &&
        workspaceScript.text.includes('analyzeButton.textContent = state.researchConversationID ? "Analyze in new research" : "Analyze"') &&
        workspaceScript.text.includes('addButton.textContent = "Add to current research"') &&
        workspaceScript.text.includes('postResearch("/research/conversations/create"') &&
        workspaceScript.text.includes('postResearch("/research/conversations/message"') &&
        workspaceScript.text.includes("opening this conversation has not called an AI model"),
      "Web Research no longer exposes selection-first, persistent conversations without an eager model call."
    );
    assert(
      !workspaceScript.text.includes("if (!window.confirm(`Archive ${name}?`)) return;"),
      "Project archiving still requires confirmation."
    );
    assert(
      workspaceScript.text.includes("await refreshOpenSavedPanes();") &&
        workspaceScript.text.includes("refreshOpenSavedPanes().catch(() => {});") &&
        workspaceScript.text.includes('instance.key === "saved"'),
      "Bookmark and tag changes no longer refresh open Saved columns immediately."
    );
    assert(
      workspaceScript.text.includes("changeReaderTextSize(panel, reader, -1)") &&
        workspaceScript.text.includes("(state.readers || []).forEach((openReader)") &&
        workspaceScript.text.includes("if (openPanel) applyReaderTextSize(openPanel, openReader)") &&
        workspaceScript.text.includes('panel.style.setProperty("--reader-font-size"') &&
        webRoot.text.includes('aria-label="Reader text size"'),
      "Reader text resize controls no longer update every open Reader."
    );
    assert(
      workspaceScript.text.includes("function stabilizeReaderSectionAtHeader") &&
        workspaceScript.text.includes('section?.querySelector(".reader-section-title")') &&
        workspaceScript.text.includes("content.__sectionAlignmentTimers"),
      "Reader navigation no longer stabilizes section titles below the header."
    );
    assert(
      workspaceScript.text.includes("function searchResultMatchesExactQuery") &&
        workspaceScript.text.includes("const filteredResults = (payload.results || []).filter((result) =>") &&
        workspaceScript.text.includes("selectedPrefixes.includes(result.codePrefix || \"BC\")") &&
        workspaceScript.text.includes("searchResultMatchesExactQuery(result, query)"),
      "Search results no longer require an exact whole-word or phrase match."
    );
    assert(
      workspaceScript.text.includes("function createSavedBulkSelectionController") &&
        workspaceScript.text.includes("function createProjectSectionSelectionController") &&
        workspaceScript.text.includes('newProjectButton.textContent = "New project…"') &&
        workspaceScript.text.includes('button.className = "reader-notes-project-option"'),
      "Saved and project panes omitted selection removal or new-project saving controls."
    );
    assert(
      workspaceScript.text.includes("function consolidatedSavedAnnotations") &&
        workspaceScript.text.includes("function mergeSavedColumnItems") &&
        workspaceScript.text.includes("async function hydrateSavedColumnItems") &&
        workspaceScript.text.includes("previewText: String(rawPreview)") &&
        workspaceScript.text.includes("/code/sections/${encodeURIComponent(detail.sectionID)}") &&
        workspaceScript.text.includes("function sortSavedItems") &&
        workspaceScript.text.includes('chapterHeader.className = "saved-chapter-header"') &&
        workspaceScript.text.includes('preview.className = "saved-paragraph-preview"') &&
        workspaceScript.text.includes('title.className = "saved-section-title"') &&
        workspaceScript.text.includes("function printSavedItemsAsPDF") &&
        workspaceScript.text.includes('renderSavedItemsByCode(content, orderedItems, paneID, { showChapterHeaders: true, preserveOrder: true })'),
      "Saved rows no longer match the iOS code, chapter, row, sort, and export structure."
    );
    assert(
      workspaceScript.text.includes("async function openReaderNotesProjectPicker") &&
        workspaceScript.text.includes("await persistSectionBookmark(sectionPayload, true)") &&
        workspaceScript.text.includes('label.textContent = "Save to project"') &&
        workspaceScript.text.includes("await removeSectionFromProject(project, existingLink, { removeBookmark: false })") &&
        workspaceScript.text.includes('doneButton.textContent = "Done"') &&
        !workspaceScript.text.includes('savedOnlyButton.textContent = "Saved items"'),
      "Reader bookmark and project selection no longer follow the iOS save-then-manage flow."
    );
    assert(
      workspaceScript.text.includes('if (window.getSelection && String(window.getSelection()).trim()) return;') &&
        workspaceScript.text.includes('openReaderNotesSheet(panel, section, reader, { target });') &&
        workspaceScript.text.includes('bookmarkButton.setAttribute("aria-label", "Manage saved projects")') &&
        workspaceScript.text.includes('button.hidden = !noteBody.trim()') &&
        workspaceScript.text.includes('bookmarkButton.hidden = !saved') &&
        workspaceScript.text.includes('const bookmarkWrapper = wrappers.find((wrapper) => wrapper.classList.contains("has-note")) || wrappers[0] || null') &&
        workspaceScript.text.includes('const showBookmark = Boolean(saved && wrapper === bookmarkWrapper)') &&
        !workspaceScript.text.includes("restoreReaderNotesSheet"),
      "Paragraph taps or saved bookmark controls no longer match the iOS note-sheet behavior."
    );
    assert(
      workspaceScript.text.includes("projectSavedSourceKey: projectKey") &&
        workspaceScript.text.includes("candidate.projectSavedSourceKey === projectKey") &&
        workspaceScript.text.includes("Object.assign(reader, readerFields)"),
      "Project saved-item clicks no longer reuse one project-linked Reader column."
    );
    assert(
      workspaceScript.text.includes('heading.className = "project-detail-section-heading"') &&
        workspaceScript.text.includes('rowNumber.className = "project-detail-section-number"') &&
        workspaceScript.text.includes('rowTitle.className = "project-detail-section-title"') &&
        !workspaceScript.text.includes('const rowBody = document.createElement("span")'),
      "Project saved rows no longer keep one inline section number and title."
    );
    assert(
      workspaceScript.text.includes("const deletion = deletedProjectSectionMutationForItem(project, item)") &&
        workspaceScript.text.includes("await pushMutation(deletion)") &&
        workspaceScript.text.includes("await removeSectionFromAllProjects(sectionPayload)") &&
        workspaceScript.text.includes("await removeSectionFromProject(project, link, { removeBookmark: false })") &&
        workspaceScript.text.includes("await persistSectionBookmark(item, false, { refreshSavedPanes: false })") &&
        workspaceScript.text.includes("syncReaderNoteBookmarkButtons(sectionID, false)"),
      "Removing a saved item no longer clears its bookmark and every project membership like iOS."
    );
    assert(
      workspaceScript.text.includes("// Keep the local record and queued mutation available while sync recovers.") &&
        workspaceScript.text.includes("// Keep the local project link and queued mutation available while sync recovers."),
      "Reader save destinations no longer complete locally while account sync is pending."
    );
    assert(
      workspaceScript.text.includes("const projectSectionsByID = new Map(") &&
        workspaceScript.text.includes('recordSurvivesBulkClear(item, clearRecords, ["bookmarks", "folders"])') &&
        workspaceScript.text.includes("projectSections: Array.from(projectSectionsByID.values()).filter((item) => !item.deletedAt)") &&
        workspaceScript.text.includes("async function refreshProjectMembershipPanes(project)") &&
        workspaceScript.text.includes("await refreshProjectMembershipPanes(project)") &&
        workspaceScript.text.includes("return currentContentSummary().annotations") &&
        workspaceScript.text.includes("leftIsLocal === rightIsLocal ? 0 : leftIsLocal ? -1 : 1") &&
        workspaceScript.text.includes('button.setAttribute("aria-label", "Bookmarked")'),
      "Local-first notes or project saves can be replaced by stale sync data or leave stale Reader bookmark labels."
    );
    assert(
      workspaceScript.text.includes("{ ...project, updatedAt: deletedAt, deletedAt }") &&
        workspaceScript.text.includes("// Keep the local deletion tombstone while sync recovers.") &&
        workspaceScript.text.includes("filter((project) => !project.deletedAt).sort"),
      "Project deletion no longer completes locally while account sync is pending."
    );
    assert(
      workspaceScript.text.includes("function closeDeletedProjectDetails()") &&
        workspaceScript.text.includes("closeDeletedProjectDetails();") &&
        workspaceScript.text.includes("deletedDetails.forEach((detail) => closeProjectDetailForProject(detail))"),
      "Remote project deletion can leave a stale project detail or Workboard column open."
    );
    assert(
      workspaceScript.text.includes('options.sourcePaneID === "utility:archive"') &&
        workspaceScript.text.includes('placePaneBefore("utility:archive", detailID)') &&
        workspaceScript.text.includes("placeArchiveAfterProjectsStack();"),
      "Archived project details no longer open immediately to the archive column's left."
    );
    assert(
      workspaceScript.text.includes("function setReaderNotesActiveTarget") &&
        workspaceScript.text.includes('annotated-code-block[data-block-id='),
      "Reader notes no longer retain the active paragraph target."
    );
    assert(
      !workspaceScript.text.includes("reader-notes-title"),
      "Reader notes still repeat the active paragraph title in the note sheet."
    );
    assert(
      workspaceScript.text.match(/codeSelect\.addEventListener\("change"[\s\S]*?closeReaderNotesSheet\(panel, reader, \{ instant: true \}\)/) &&
        workspaceScript.text.match(/chapterSelect\.addEventListener\("change"[\s\S]*?closeReaderNotesSheet\(panel, reader, \{ instant: true \}\)/),
      "Reader notes no longer close immediately when the code or chapter changes."
    );

    const workspaceStyles = await request("/web/styles.css");
    assert(workspaceStyles.response.ok, "Web workspace stylesheet did not load.");
    assert(
      workspaceStyles.text.match(/\.saved-project-tile \{[\s\S]*?border: 0;[\s\S]*?background: color-mix\(in srgb, var\(--project-color\) 42%, var\(--surface\)\);[\s\S]*?color: var\(--text-primary\);/),
      "Saved project tiles no longer use a borderless muted project tint with a contrast-safe foreground."
    );
    assert(
      workspaceStyles.text.match(/\.settings-panel \.account-plan-secondary \{[\s\S]*?justify-self: center;/),
      "Restore Purchases is no longer centered beneath the primary plan action."
    );
    assert(
      workspaceStyles.text.match(/\.settings-project-copy strong \{[^}]*color: var\(--project-color\);[^}]*font-weight: 400;[^}]*text-transform: none;/) &&
        !workspaceStyles.text.includes(".settings-project-swatch"),
      "Project selection rows no longer use regular-weight project-colored names without a separate color dot."
    );
    assert(
      !workspaceStyles.text.includes(".annotated-code-block:hover .inline-comment-toggle") &&
        !workspaceStyles.text.includes(".annotated-code-block:hover .inline-bookmark-toggle"),
      "Reader annotation status icons still appear on hover without a saved note or bookmark."
    );
    assert(
      workspaceStyles.text.match(/\.search-box \{[\s\S]*?width: 254px;[\s\S]*?max-width: 100%;[\s\S]*?height: 42px;[\s\S]*?min-height: 42px;/),
      "Search field no longer renders at 254 by 42 pixels."
    );
    assert(
      !workspaceStyles.text.includes(".result-row-actions") &&
        !workspaceStyles.text.includes(".result-reader-action"),
      "Search results still include styling for the retired Reader action buttons."
    );
    assert(
      workspaceStyles.text.match(/input:focus,[\s\S]*?input:focus-visible,[\s\S]*?textarea:focus,[\s\S]*?textarea:focus-visible \{[\s\S]*?outline: 0;[\s\S]*?outline-offset: 0;/),
      "Text fields can still render the browser's rectangular focus outline."
    );
    assert(
      !workspaceStyles.text.includes(".panel-track.is-resizing *"),
      "Divider resizing still invalidates cursor styles across every workspace descendant."
    );
    assert(
      workspaceStyles.text.includes("scrollbar-width: none !important") &&
        workspaceStyles.text.includes("scroll-snap-type: x mandatory") &&
        workspaceStyles.text.includes("flex: 0 0 100% !important"),
      "Hidden scrollbars or one-pane mobile behavior regressed."
    );
    assert(
      workspaceStyles.text.includes(".web-warning-backdrop") &&
        workspaceStyles.text.includes(".web-warning-dialog") &&
        workspaceStyles.text.includes("width: min(550px, 100%);") &&
        workspaceStyles.text.includes(".web-warning-title") &&
        workspaceStyles.text.includes("border-bottom: 1px solid var(--border);") &&
        workspaceStyles.text.includes(".web-warning-cancel") &&
        workspaceStyles.text.includes(".web-warning-confirm") &&
        workspaceStyles.text.includes("background: #df6464;"),
      "Web warning-dialog proportions or action styling regressed."
    );
    assert(
      workspaceStyles.text.includes("min-width: max(var(--pane-default-min-width), min(var(--pane-min-width), var(--pane-resized-min-width)));"),
      "Pane CSS no longer enforces the default-width floor for multi-column workspaces."
    );
    assert(
      workspaceStyles.text.includes(".reader-notes-project-picker .reader-notes-project-option") &&
        workspaceStyles.text.includes("background: color-mix(in srgb, var(--project-color) 16%, transparent);") &&
        workspaceStyles.text.includes(".reader-notes-project-picker .reader-notes-project-option.is-selected") &&
        workspaceStyles.text.includes(".reader-notes-project-check") &&
        workspaceStyles.text.includes("border-radius: var(--radius-pill);"),
      "Reader project-picker buttons no longer use pill-shaped project-card color treatments."
    );
    assert(
      workspaceStyles.text.includes(".reader-notes-new-project-form input:focus-visible") &&
        workspaceStyles.text.includes("background: color-mix(in srgb, var(--text-primary) 6%, var(--reader-notes-input-surface));") &&
        workspaceStyles.text.match(/\.reader-notes-new-project-form input \{[\s\S]*?border: 0;[\s\S]*?outline: 0;[\s\S]*?box-shadow: none;/),
      "The inline new-project field regained a visible edge treatment."
    );
    assert(
      workspaceStyles.text.includes(".reader-notes-new-project-form button:focus-visible") &&
        workspaceStyles.text.match(/\.reader-notes-new-project-form button \{[\s\S]*?border: 0;[\s\S]*?outline: 0;[\s\S]*?box-shadow: none;/),
      "The inline create-and-save button regained a visible edge treatment."
    );
    assert(
      workspaceStyles.text.includes(".saved-panel .saved-code-group .saved-row") &&
        workspaceStyles.text.includes(".saved-chapter-header") &&
        workspaceStyles.text.includes(".saved-inline-filters") &&
        workspaceStyles.text.includes(".saved-paragraph-preview") &&
        workspaceStyles.text.includes("-webkit-line-clamp: 2;") &&
        workspaceStyles.text.includes(".saved-section-meta"),
      "Saved rows no longer keep their proportional grouped layout and two-line paragraph previews."
    );
    assert(
      !workspaceStyles.text.includes(".reader-section-title {\n  cursor: pointer;"),
      "Static Reader section titles still use pointer styling."
    );
    assert(
      workspaceStyles.text.includes(".section-detail-tags .annotation-tag-input"),
      "Section-detail tag inputs omitted their pill treatment."
    );
    assert(
      workspaceStyles.text.includes(".reader-notes-tags .annotation-tag-input") &&
        workspaceStyles.text.includes("calc(var(--space-5) + var(--space-4))"),
      "Reader notes tag inputs omitted their pill treatment or bottom clearance."
    );
    assert(
      workspaceStyles.text.includes("--reader-notes-active-text: #00636d") &&
        workspaceStyles.text.includes("--reader-notes-active-text: #91e8ef") &&
        workspaceStyles.text.includes(".annotated-code-block.is-notes-active"),
      "Reader note targets omitted their theme-aware paragraph highlight."
    );
    assert(
      workspaceStyles.text.includes(".code-table :where(table, thead, tbody, tfoot, tr, td, th") &&
        workspaceStyles.text.includes("color: inherit !important;") &&
        workspaceStyles.text.includes('[style*="background-color:#C0C0C0" i]') &&
        workspaceStyles.text.includes('[style*="background-color:#808080" i]'),
      "Reader tables no longer override legacy light-theme colors in dark mode."
    );
    assert(
      workspaceStyles.text.includes(".project-bulk-bar") &&
        workspaceStyles.text.includes(".is-project-selecting .project-selection-check") &&
        workspaceStyles.text.includes(".project-row.is-selected"),
      "Project bulk selection omitted its toolbar, selection indicators, or selected-card treatment."
    );
    assert(
      workspaceStyles.text.includes(".saved-note-preview") &&
        workspaceStyles.text.includes(".project-saved-code-group") &&
        workspaceStyles.text.includes(".project-detail-section-preview") &&
        workspaceStyles.text.includes(".project-detail-section-heading") &&
        workspaceStyles.text.match(/\.project-detail-saved-row \{[\s\S]*?border-bottom: 1px solid var\(--border\);[\s\S]*?border-radius: 0;/),
      "Saved and project cards omitted note previews, code grouping, or section previews."
    );
    assert(
      workspaceStyles.text.includes(".panel-kind {\n  color: #000;") &&
        workspaceStyles.text.includes(".panel-kind {\n    color: #fff;"),
      "Column labels no longer maintain high contrast across light and dark appearance."
    );
    assert(
      workspaceStyles.text.includes("*::-webkit-scrollbar") &&
        workspaceStyles.text.includes("display: none !important") &&
        workspaceStyles.text.includes("width: 0 !important") &&
        workspaceStyles.text.includes("height: 0 !important"),
      "Web workspace no longer hides scrollbars globally."
    );
    assert(
      workspaceStyles.text.includes(".reader-scroll-indicator") &&
        workspaceStyles.text.includes("display: none;"),
      "Reader workspace still renders its custom scroll indicator."
    );
    assert(
      workspaceStyles.text.match(/\.reader-panel \.panel-actions \{[\s\S]*?align-items: center;[\s\S]*?gap: var\(--space-2\);/) &&
        workspaceStyles.text.match(/\.reader-text-size-controls,[\s\S]*?\.reader-spacing-controls \{[\s\S]*?grid-template-columns: repeat\(2, var\(--panel-title-control-size\)\);[\s\S]*?gap: var\(--space-2\);/) &&
        workspaceStyles.text.match(/\.reader-text-size-button,[\s\S]*?\.reader-spacing-button \{[\s\S]*?place-items: center;/),
      "Reader header controls are no longer equally spaced and center-aligned."
    );

    const workboardScript = await request("/web/workboard-assets/workboard.js");
    assert(workboardScript.response.ok, "Nested Workboard script asset did not load.");
    assert(
      workspaceScript.text.includes('const workboardClientVersion = "20260724-workboard-preview-v17";') &&
        webRoot.text.includes('/web/workboard-assets/workboard.css?v=20260722-workboard-zoom-v57'),
      "Web workspace omitted the current Workboard preview assets."
    );
    assert(
      workboardScript.response.headers.get("content-type")?.includes("javascript"),
      "Workboard script asset returned the wrong content type."
    );
    assert(
      workboardScript.response.headers.get("cache-control")?.includes("immutable"),
      "Versioned Workboard assets were not browser-cacheable."
    );
    assert(
      workboardSource.includes("function usePreferredTheme()") &&
        workboardSource.includes('mediaQuery.addEventListener("change", updateTheme)') &&
        workboardSource.includes("theme={theme}"),
      "Workboard no longer follows live system appearance changes."
    );
    assert(
      workboardSource.includes("const preventWheelPanning = (event) =>") &&
        workboardSource.includes("if (event.ctrlKey || event.metaKey) return;") &&
        workboardSource.includes("event.stopImmediatePropagation();") &&
        workboardSource.includes('host.addEventListener("wheel", preventWheelPanning, { capture: true, passive: false })'),
      "Workboard wheel panning guard no longer preserves trackpad and modified-wheel zoom gestures."
    );
    assert(
      workboardSource.includes("const setWorkboardZoom = useCallback") &&
        workboardSource.includes('aria-label="Zoom out"') &&
        workboardSource.includes('aria-label="Reset zoom"') &&
        workboardSource.includes('aria-label="Zoom in"'),
      "Workboard omitted its compact zoom controls."
    );
    assert(
      workboardSource.includes("exportToBlob") &&
        workboardSource.includes("await savePreview(null") &&
        workboardSource.includes("await savePreview(blob") &&
        workspaceScript.text.includes("async function saveWorkboardPreview") &&
        workspaceScript.text.includes('postJSON("/workboards/previews/clear"') &&
        workspaceScript.text.includes('new URL("/workboards/previews/upload"'),
      "Workboard no longer persists its flattened Project preview after a successful sync."
    );
    const workboardStyles = await request("/web/workboard-assets/workboard.css");
    assert(workboardStyles.response.ok, "Nested Workboard stylesheet asset did not load.");
    assert(
      workboardStyles.response.headers.get("content-type")?.includes("text/css"),
      "Workboard stylesheet asset returned the wrong content type."
    );
    assert(
      workboardStyleSource.includes("--color-surface-primary-container:") &&
        workboardStyleSource.includes("--color-brand-active: var(--project-color"),
      "Workboard active tools no longer inherit the project color."
    );
    const workboardFont = await request(
      "/web/workboard-assets/fonts/Xiaolai/Xiaolai-Regular-353f33792a8f60dc69323ddf635a269e.woff2"
    );
    assert(workboardFont.response.ok, "Nested Workboard font asset did not load.");
    assert(
      workboardFont.response.headers.get("content-type")?.includes("font/woff2"),
      "Workboard font asset returned the wrong content type."
    );

    const sharedSectionLink = await request("/open/section/8881");
    assert(sharedSectionLink.response.ok, "Shared section URL did not load the web workspace.");
    assert(
      sharedSectionLink.response.headers.get("content-type")?.includes("text/html"),
      "Shared section URL did not return the web workspace HTML."
    );
    const zoningSectionLink = await request("/open/section/20018521");
    assert(zoningSectionLink.response.ok, "Zoning section URL did not load the web workspace.");

    const detachedWorkboard = await request("/detached-workboard");
    assert(detachedWorkboard.response.ok, "Detached Workboard URL did not load the web workspace.");
    assert(
      detachedWorkboard.response.headers.get("content-type")?.includes("text/html"),
      "Detached Workboard URL did not return the web workspace HTML."
    );

    const canonicalOverrideSection = await request("/code/sections/8881");
    assert(canonicalOverrideSection.response.ok, "Canonical section override did not load.");
    assert(canonicalOverrideSection.json.section.sectionID === 8881, "Canonical section override returned the wrong ID.");
    assert(canonicalOverrideSection.json.section.chapterID, "Canonical section response omitted its chapter ID.");
    assert(canonicalOverrideSection.json.section.codePrefix, "Canonical section response omitted its code prefix.");
    assert(canonicalOverrideSection.json.section.sectionNumber, "Canonical section response omitted its section number.");
    assert(
      canonicalOverrideSection.json.section.blocks?.some((block) =>
        block.plainText?.includes("real time enforcement unit")
      ),
      "Web reader did not prefer the canonical iPhone section body."
    );
    const administrativeChapter4Section = await request("/code/sections/9810");
    assert(administrativeChapter4Section.response.ok, "Administrative section 28-401.1 did not load.");
    assert(
      administrativeChapter4Section.json.section.codePrefix === "AC" &&
        administrativeChapter4Section.json.section.chapterID === 77 &&
        administrativeChapter4Section.json.section.sectionNumber === "28-401.1",
      "Administrative section 28-401.1 returned the wrong code or chapter identity."
    );
    const administrativeChapter4Text = administrativeChapter4Section.json.section.blocks
      .map((block) => block.plainText || "")
      .join(" ");
    assert(
      administrativeChapter4Text.includes(
        "This chapter shall apply to the licensing and registration of businesses, trades and occupations engaged in building work regulated by this code."
      ) &&
        !administrativeChapter4Section.json.section.blocks.some((block) => block.kind === "title") &&
        !administrativeChapter4Text.trim().startsWith("§ 28-401.1"),
      "Administrative Chapter 4 repeated its section title or omitted the official provision body."
    );
    const administrativeChapter4 = await request("/code/chapters/77?include=body");
    assert(administrativeChapter4.response.ok, "Administrative Chapter 4 did not load with section bodies.");
    assert(
      administrativeChapter4.json.chapter.groups?.[0]?.headerLine === "SECTION 28-401" &&
        administrativeChapter4.json.chapter.sections?.[0]?.headerLine === "SECTION 28-401",
      "Administrative Chapter 4 retained the incorrect Building Code prefix in its group heading."
    );
    assert(
      administrativeChapter4.json.chapter.sections.some((section) =>
        section.id === 9810 &&
        section.blocks?.some((block) =>
          block.plainText?.startsWith("This chapter shall apply to the licensing and registration")
        )
      ),
      "Administrative Chapter 4 did not expose its corrected section body in chapter reading."
    );

    const ancillaryDwellingUnitRules = await request("/code/sections/25651");
    assert(ancillaryDwellingUnitRules.response.ok, "Newly cataloged BC U101.5 did not load.");
    assert(
      ancillaryDwellingUnitRules.json.section.codePrefix === "BC" &&
        ancillaryDwellingUnitRules.json.section.chapterNumber === "U" &&
        ancillaryDwellingUnitRules.json.section.sectionNumber === "U101.5" &&
        ancillaryDwellingUnitRules.json.section.blocks?.some((block) =>
          block.plainText?.includes("consult with the fire department and the office of emergency management")
        ),
      "BC U101.5 did not preserve its source identity and provision body."
    );
    const ancillaryDwellingUnitRulesSearch = await request(
      "/code/search?q=U101.5%20Department%20rules.&code=BC&limit=20"
    );
    assert(
      ancillaryDwellingUnitRulesSearch.response.ok &&
        ancillaryDwellingUnitRulesSearch.json.results.some((result) => result.id === 25651),
      "Construction search omitted newly cataloged BC U101.5."
    );
    const missingSharedSection = await request("/code/sections/999999999");
    assert(missingSharedSection.response.status === 404, "Unknown shared section did not return 404.");

    const sectionBatch = await request("/code/sections?ids=8881,8882,999999999");
    assert(sectionBatch.response.ok, "Canonical section metadata batch did not load.");
    assert(
      sectionBatch.json.sections.map((section) => section.sectionID || section.id).join(",") === "8881,8882",
      "Canonical section metadata batch returned unexpected sections or order."
    );
    assert(
      sectionBatch.json.sections.map((section) => section.requestedID).join(",") === "8881,8882",
      "Canonical section metadata batch did not preserve requested IDs."
    );
    const oversizedSectionBatch = await request(`/code/sections?ids=${Array.from({ length: 101 }, (_, index) => index + 1).join(",")}`);
    assert(oversizedSectionBatch.response.status === 400, "Oversized section metadata batch was not rejected.");

    const codeLibraries = await request("/code/libraries");
    assert(codeLibraries.response.ok, "Code-library metadata did not load.");
    const zoningLibrary = codeLibraries.json.libraries.find((library) => library.id === "nyc-zoning-resolution");
    assert(zoningLibrary, "Code-library metadata omitted the Zoning Resolution.");
    assert(zoningLibrary.syncCodeVersion === zoningSyncCodeVersion, "Zoning library returned the wrong sync identity.");
    assert(zoningLibrary.textChangesThrough === "2026-07-16", "Zoning library returned the wrong source cutoff.");
    assert(zoningLibrary.researchEligibility === false, "Zoning Research was enabled before its approval gate.");

    const zoningChapters = await request("/code/chapters?code=ZR");
    assert(zoningChapters.response.ok, "Zoning chapter index did not load.");
    assert(zoningChapters.json.chapters.length === 117, "Zoning chapter index was incomplete.");
    assert(zoningChapters.json.chapters.every((chapter) => chapter.codePrefix === "ZR"));
    const zoningChapter = await request("/code/chapters/15000102?include=body");
    assert(zoningChapter.response.ok, "Zoning chapter I-2 did not load.");
    assert(zoningChapter.json.chapter.codeVersion === zoningSyncCodeVersion);
    assert(
      zoningChapter.json.chapter.sections.some((section) =>
        section.sectionNumber === "12-01" &&
        section.blocks?.some((block) => block.plainText?.includes("particular shall control the general"))
      ),
      "Zoning chapter I-2 omitted its canonical section body."
    );
    const zoningSection = await request("/code/sections/20018521");
    assert(zoningSection.response.ok, "Zoning section 12-01 did not load.");
    assert(zoningSection.json.section.codePrefix === "ZR");
    assert(zoningSection.json.section.codeVersion === zoningSyncCodeVersion);
    assert(zoningSection.json.section.zoning.researchEligibility === false);
    assert(zoningSection.json.section.zoning.amendmentHistory.length > 0);
    const zoningSectionBatch = await request("/code/sections?ids=20018521,8881");
    assert(zoningSectionBatch.response.ok, "Mixed-library section metadata batch did not load.");
    assert(
      zoningSectionBatch.json.sections.map((section) => section.requestedID).join(",") === "20018521,8881" &&
        zoningSectionBatch.json.sections[0].codePrefix === "ZR" &&
        zoningSectionBatch.json.sections[1].codePrefix !== "ZR",
      "Mixed-library section metadata batch did not preserve requested order."
    );
    const zoningSearch = await request("/code/search?q=particular%20shall%20control&code=ZR&limit=20");
    assert(zoningSearch.response.ok, "Zoning search did not load.");
    assert(
      zoningSearch.json.results.some((result) =>
        result.id === 20_018_521 &&
        result.codeVersion === zoningSyncCodeVersion
      ),
      "Zoning search did not return section 12-01 with its library identity."
    );
    assert(
      zoningSearch.json.results.every((result) => result.codePrefix === "ZR"),
      "Zoning-only search leaked another code library."
    );
    const zoningAsset = await requestBinary(
      "/code/assets/zr-cb9efe3ace35b565-06-Hunts-Point-Map-3-Subarea-2-01_0.jpg"
    );
    assert(zoningAsset.response.ok, "Zoning map asset did not load.");
    assert(
      zoningAsset.response.headers.get("content-type")?.includes("image/jpeg") &&
        zoningAsset.body.length === 994_765,
      "Zoning map asset returned the wrong media."
    );

    const duplicateNumberChapter = await request("/code/chapters/47");
    assert(duplicateNumberChapter.response.ok, "Duplicate-number appendix chapter did not load.");
    const duplicateNumberSections = duplicateNumberChapter.json.chapter.sections.filter((section) =>
      section.sectionNumber === "8.5"
    );
    assert(duplicateNumberSections.length === 2, "Duplicate-number appendix provisions were collapsed.");
    assert(
      new Set(duplicateNumberSections.map((section) => section.id)).size === 2,
      "Duplicate-number appendix provisions did not retain distinct canonical IDs."
    );

    const searchGolden = JSON.parse(await readFile(new URL(
      "../../NYC CC APP/Tools/search-regression/golden-results.json",
      import.meta.url
    ), "utf8"));
    for (const [query, expectedIDs] of Object.entries(searchGolden)) {
      const search = await request(
        `/code/search?q=${encodeURIComponent(query)}&code=BC,AC,PC,MC,FGC&limit=200`
      );
      assert(search.response.ok, `Canonical web search failed for ${query}.`);
      const actualIDs = search.json.results.map((result) => result.id);
      const firstMismatch = expectedIDs.findIndex((id, index) => actualIDs[index] !== id);
      assert(
        JSON.stringify(actualIDs) === JSON.stringify(expectedIDs),
        `Canonical web search drifted from iPhone ordering for ${query}: ` +
          `expected ${expectedIDs.length}, received ${actualIDs.length}, first mismatch at ${firstMismatch} ` +
          `(${expectedIDs[firstMismatch]} vs ${actualIDs[firstMismatch]}).`
      );
    }

    const appleWebConfig = await request("/account/apple-web-config");
    assert(appleWebConfig.response.ok, "Apple web sign-in config failed.");
    assert(appleWebConfig.json.available === true, "Apple web sign-in config did not report availability.");
    assert(
      appleWebConfig.json.clientID === "com.randycodex.permitext.web",
      "Apple web sign-in config returned the wrong client ID."
    );
    assert(
      appleWebConfig.json.redirectURI === `${baseURL}/account/apple/callback`,
      "Apple web sign-in config returned the wrong redirect URI."
    );
    assert(
      appleWebConfig.json.identityTokenRequired === false,
      "Local smoke configuration unexpectedly required a real Apple identity token."
    );

    const appleWebStart = await request("/account/apple/start", {
      method: "POST",
      body: { successURL: "/" }
    });
    assert(appleWebStart.response.ok, "Apple web sign-in start failed.");
    assert(
      appleWebStart.json.authorizationURL?.startsWith("https://appleid.apple.com/auth/authorize?"),
      "Apple web sign-in start did not return an Apple authorize URL."
    );
    assert(
      appleWebStart.response.headers.get("set-cookie")?.includes("permitext_apple_oauth="),
      "Apple web sign-in start did not set the OAuth state cookie."
    );
    const productionAppleWebStart = await request("/account/apple/start", {
      method: "POST",
      body: { successURL: "/" },
      headers: { "x-forwarded-host": "permitext-sync.vercel.app" }
    });
    const productionAppleCookie = productionAppleWebStart.response.headers.get("set-cookie") || "";
    assert(productionAppleCookie.includes("SameSite=None"), "Production Apple OAuth cookie must allow cross-site form POST.");
    assert(productionAppleCookie.includes("Secure"), "Production Apple OAuth cookie must be Secure.");

    const appleWebCallback = await request("/account/apple/callback");
    assert(appleWebCallback.response.ok, "Apple web sign-in callback did not load.");
    assert(
      appleWebCallback.response.headers.get("content-type")?.includes("text/html"),
      "Apple web sign-in callback did not return HTML."
    );
    assert(
      appleWebCallback.response.headers.get("content-security-policy")?.includes("nonce-"),
      "Apple web sign-in callback CSP omitted its script nonce."
    );
    assert(appleWebCallback.text.includes("<script nonce="), "Apple web sign-in callback script omitted its nonce.");
    assert(
      appleWebCallback.text.includes('const accountSessionKey = "permitext:webAccount:v1"'),
      "Apple web sign-in callback did not persist the dedicated account session."
    );

    const webCheckoutFallback = await request("/web/?checkout=success");
    assert(webCheckoutFallback.response.ok, "Legacy checkout return URL did not load.");
    assert(
      webCheckoutFallback.response.headers.get("content-type")?.includes("text/html"),
      "Legacy checkout return URL did not return HTML."
    );

    const checkoutReturn = await request("/?checkout=success&session_id=cs_smoke");
    assert(checkoutReturn.response.ok, "Checkout return URL with session ID did not load.");
    assert(
      checkoutReturn.response.headers.get("content-type")?.includes("text/html"),
      "Checkout return URL with session ID did not return HTML."
    );

    const unauthorizedStorageSummary = await request("/admin/storage/summary");
    assert(unauthorizedStorageSummary.response.status === 401, "Storage summary allowed an unauthenticated request.");

    const storageSummary = await request("/admin/storage/summary", {
      token: adminToken
    });
    assert(storageSummary.response.ok, "Storage summary failed.");
    assert(storageSummary.json.storage === "file", "Local storage summary did not report file storage.");
    assert(storageSummary.json.schema === "json-file", "Local storage summary did not report the file schema.");
    assert(storageSummary.json.latestEventID === 0, "Local storage summary should report event cursor 0.");

    const unauthorizedGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      body: { userID }
    });
    assert(unauthorizedGrant.response.status === 401, "Admin route allowed an unauthenticated grant.");

    const unsignedPush = await request("/sync/push", {
      method: "POST",
      body: {
        auth: { accountUserID: "apple:unsigned-user" },
        batch: {
          user: { id: "apple:unsigned-user" },
          mutations: []
        }
      }
    });
    assert(unsignedPush.response.status === 401, "Push allowed a user with no backend session.");

    const freeResearchSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-free-research-user",
          displayName: "Free Research Smoke User"
        }
      }
    });
    assert(freeResearchSignIn.response.ok, "Free Research smoke account sign-in failed.");
    const freeResearchUserID = freeResearchSignIn.json.account.appUserID;
    const freeResearchToken = freeResearchSignIn.json.account.backendSessionToken;
    const freeCapabilityPull = await request("/sync/pull", {
      method: "POST",
      token: freeResearchToken,
      body: {
        auth: { accountUserID: freeResearchUserID },
        syncSchemaVersion: 2,
        clientCapabilities: ["research", "offline-access"]
      }
    });
    assert(freeCapabilityPull.response.ok, "Free capability contract pull failed.");
    assert(
      freeCapabilityPull.json.capabilityContract?.capabilities?.research?.enabled === false &&
        freeCapabilityPull.json.capabilityContract?.capabilities?.["offline-access"]?.enabled === false,
      "Free capability contract incorrectly unlocked Research or offline access."
    );
    const freeResearchCreate = await request("/research/conversations/create", {
      method: "POST",
      token: freeResearchToken,
      body: {
        auth: { accountUserID: freeResearchUserID },
        sectionID: "1",
        selectedText: "Any selected text"
      }
    });
    assert(
      freeResearchCreate.response.status === 402 &&
        freeResearchCreate.json.code === "RESEARCH_ADDON_REQUIRED",
      "Free account was allowed to create Research."
    );
    const freeEvidenceDiscovery = await request("/research/evidence/discover", {
      method: "POST",
      token: freeResearchToken,
      body: {
        auth: { accountUserID: freeResearchUserID },
        question: "Can a scissor stair count as two exits?"
      }
    });
    assert(
      freeEvidenceDiscovery.response.status === 402 &&
        freeEvidenceDiscovery.json.code === "RESEARCH_ADDON_REQUIRED",
      "Free account was allowed to use Find Relevant Evidence."
    );

    const grant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: grantAdminToken,
      body: { userID }
    });
    assert(grant.response.ok, "Lifetime grant failed.");
    assert(grant.json.entitlement.source === "lifetimeGrant", "Lifetime grant source was not persisted.");

    const signIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-user",
          displayName: "Smoke User"
        }
      }
    });
    assert(signIn.response.ok, "Sign-in failed.");
    assert(signIn.json.account.appUserID === userID, "Sign-in returned the wrong user ID.");
    assert(signIn.json.account.backendSessionToken, "Sign-in did not return a backend session token.");
    assert(signIn.json.entitlement?.source === "lifetimeGrant", "Sign-in did not return the granted entitlement.");
    const discoveryCapabilityPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        syncSchemaVersion: 2,
        clientCapabilities: ["evidence-discovery"]
      }
    });
    assert(
      discoveryCapabilityPull.response.ok &&
        discoveryCapabilityPull.json.capabilityContract.capabilities["evidence-discovery"].enabled === true &&
        discoveryCapabilityPull.json.capabilityContract.capabilities["evidence-discovery"].release === "private-beta",
      "The private-beta capability contract did not expose evidence discovery to an entitled account."
    );
    const scissorEvidenceDiscovery = await request("/research/evidence/discover", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "Our Group R-2 building has a scissor stair. Can the stairs count as two exits?",
        limit: 12
      }
    });
    assert(
      scissorEvidenceDiscovery.response.ok &&
        scissorEvidenceDiscovery.json.generatedAnswer === false &&
        scissorEvidenceDiscovery.json.paidModelCall === false &&
        scissorEvidenceDiscovery.json.candidates.length > 0 &&
        scissorEvidenceDiscovery.json.candidates.every((candidate) =>
          candidate.candidateState === "candidate" &&
          candidate.selectedText &&
          !candidate.approved
        ) &&
        scissorEvidenceDiscovery.json.candidates.some((candidate) =>
          candidate.sectionID === "2197" &&
          candidate.codePrefix === "BC" &&
          candidate.sectionNumber === "1007.1.1"
        ),
      "Find Relevant Evidence did not return unapproved canonical scissor-stair candidates without generating an answer."
    );
    const outsideAuthorityDiscovery = await request("/research/evidence/discover", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "Does this section prove that HCR requires a vanity?"
      }
    });
    assert(
      outsideAuthorityDiscovery.response.ok &&
        outsideAuthorityDiscovery.json.coverageLimitations.some((item) =>
          item.kind === "query-context-required"
        ) &&
        outsideAuthorityDiscovery.json.outsideCurrentLibrary.some((item) =>
          item.label === "HCR requirements"
        ),
      "Evidence discovery did not disclose missing section context and outside-agency authority."
    );

    const unauthorizedGrantSummaries = await request("/admin/accounts/grant-summaries");
    assert(
      unauthorizedGrantSummaries.response.status === 401,
      "Grant account summaries allowed an unauthenticated request."
    );
    const grantSummaries = await request("/admin/accounts/grant-summaries", {
      token: grantAdminToken
    });
    assert(grantSummaries.response.ok, "Grant account summaries failed.");
    const smokeAccountSummary = grantSummaries.json.accounts.find((account) => account.userID === userID);
    assert(smokeAccountSummary?.hasActiveSession === true, "Grant account summaries omitted the active account.");
    assert(
      smokeAccountSummary?.entitlement?.source === "lifetimeGrant",
      "Grant account summaries omitted the account entitlement."
    );

    const clearScopes = ["bookmarks", "notes", "tags"];
    const clearMutations = clearScopes.map((scope, index) => ({
      codeVersionClear: {
        userID,
        codeVersion: "2022 Construction Codes",
        values: { scope },
        updatedAt: new Date(Date.now() + index).toISOString()
      }
    }));
    const pushClears = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: clearMutations }
      }
    });
    assert(pushClears.response.ok, "Bulk clear sync push failed.");
    assert(pushClears.json.acceptedMutationIDs.length >= 3, "Bulk clear categories overwrote one another during push.");
    assert(
      clearScopes.every((scope) => pushClears.json.acceptedMutationIDs.some((id) => id.endsWith(`:${scope}`))),
      "Bulk clear sync IDs did not preserve their category scope."
    );
    const pullClears = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const pulledClearScopes = pullClears.json.mutations
      .filter((mutation) => mutation.codeVersionClear)
      .map((mutation) => mutation.codeVersionClear.values?.scope);
    assert(
      clearScopes.every((scope) => pulledClearScopes.includes(scope)),
      "A bulk clear category disappeared before another client could pull it."
    );

    const aliasUserID = "apple:alias-ack-user";
    const aliasSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "alias-ack-user",
          displayName: "Alias Ack User"
        }
      }
    });
    assert(aliasSignIn.response.ok, "Alias acknowledgment test sign-in failed.");
    const submittedLegacyMutationID = `${aliasUserID}:legacy-saved:1`;
    const canonicalSavedMutationID = `${aliasUserID}:saved:${defaultSyncCodeVersion}:1`;
    const pushLegacySavedItem = await request("/sync/push", {
      method: "POST",
      token: aliasSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: aliasUserID },
        batch: {
          user: { id: aliasUserID },
          mutations: [{
            savedItem: {
              id: submittedLegacyMutationID,
              userID: aliasUserID,
              codeVersion: "2022 Construction Codes",
              codePrefix: "BC",
              chapterNumber: "1",
              sectionID: 1,
              sectionNumber: "101.1",
              title: "Title.",
              updatedAt: new Date(Date.now() + 10).toISOString()
            }
          }]
        }
      }
    });
    assert(pushLegacySavedItem.response.ok, "Legacy saved-item sync push failed.");
    assert(
      pushLegacySavedItem.json.acceptedMutationIDs.includes(submittedLegacyMutationID) &&
        pushLegacySavedItem.json.acceptedMutationIDs.includes(canonicalSavedMutationID),
      "A server-canonicalized mutation did not acknowledge the client's submitted queue ID."
    );

    const unauthorizedResearch = await request("/research/interpret", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        question: "What notice is required?",
        sectionIDs: ["8881"]
      }
    });
    assert(unauthorizedResearch.response.status === 401, "Research interpretation allowed an unauthenticated request.");

    const retiredResearchInterpretation = await request("/research/interpret", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "What notice is required before work begins?",
        sectionIDs: ["8881"],
        evidence: "The client must not be allowed to supply model evidence."
      }
    });
    assert(
      retiredResearchInterpretation.response.status === 410,
      "The retired whole-section Research entry point still accepted new analysis."
    );
    assert(
      retiredResearchInterpretation.json.code === "RESEARCH_CONVERSATIONS_REQUIRED",
      "The retired Research entry point did not direct the client to private passage conversations."
    );

    const researchProjectIDs = ["research-project-alpha", "research-project-beta"];
    const researchSavedItemID = `${userID}:saved:${defaultSyncCodeVersion}:8881`;
    const researchProjectPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [
            ...researchProjectIDs.map((clientID, index) => ({
              project: {
                id: `research-project-record-${index + 1}`,
                userID,
                codeVersion: defaultSyncCodeVersion,
                clientID,
                name: index === 0 ? "Research Alpha" : "Research Beta",
                description: "",
                colorHex: index === 0 ? "#6674c8" : "#4f8f8b",
                sortOrder: index,
                updatedAt: new Date(Date.now() + index).toISOString()
              }
            })),
            {
              savedItem: {
                id: "research-saved-item-record",
                userID,
                codeVersion: defaultSyncCodeVersion,
                codePrefix: "AC",
                chapterNumber: "28",
                sectionID: 8881,
                sectionNumber: "28-103.21",
                title: "Real time enforcement.",
                updatedAt: new Date(Date.now() + researchProjectIDs.length).toISOString()
              }
            }
          ]
        }
      }
    });
    assert(
      researchProjectPush.response.ok &&
        researchProjectIDs.every((projectID) =>
          researchProjectPush.json.acceptedMutationIDs.some((mutationID) => mutationID.endsWith(`:${projectID}`))
        ) &&
        researchProjectPush.json.acceptedMutationIDs.includes(researchSavedItemID),
      "Project-linked Research fixtures did not sync as owned Projects with saved-section provenance."
    );

    const selectedResearchText = "Owners of such buildings shall notify the department in writing at least 72 hours prior to the commencement of any work pursuant to such permits.";
    const unauthorizedConversation = await request("/research/conversations/create", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        sectionID: "8881",
        selectedText: selectedResearchText
      }
    });
    assert(unauthorizedConversation.response.status === 401, "Research conversation creation allowed an unauthenticated request.");

    const invalidSelection = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: "8881",
        selectedText: "This sentence is not enacted text."
      }
    });
    assert(invalidSelection.response.status === 400, "Research conversation accepted client text that is absent from the canonical section.");

    const inlineStyledResearchText = 'This code shall be known and may be cited as the "New York City Building Code," "NYCBC" or "BC". All section numbers in this code shall be deemed to be preceded by the designation "BC".';
    const inlineStyledConversation = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: "1",
        selectedText: inlineStyledResearchText
      }
    });
    assert(
      inlineStyledConversation.response.status === 201 &&
        inlineStyledConversation.json.conversation.sources[0].selectedText === inlineStyledResearchText,
      "Research conversation rejected rendered enacted text when prepared plain text added spaces around inline styling."
    );

    const createdConversation = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: "8881",
        selectedText: `${selectedResearchText} Has note Bookmarked`,
        projectID: researchProjectIDs[0],
        savedItemID: researchSavedItemID
      }
    });
    assert(createdConversation.response.status === 201, "Research conversation creation failed.");
    assert(createdConversation.json.conversation.messages.length === 0, "Creating research unexpectedly generated an AI message.");
    assert(
        createdConversation.json.conversation.sources[0].selectedText === selectedResearchText &&
        createdConversation.json.conversation.sources[0].sectionTextHash &&
        createdConversation.json.conversation.primaryProjectID === researchProjectIDs[0] &&
        createdConversation.json.conversation.origin.savedItemID === researchSavedItemID,
      "Research conversation did not preserve a canonical selected passage, Project link, and saved-section provenance."
    );
    const conversationID = createdConversation.json.conversation.id;

    const invalidProjectContext = await request("/research/conversations/project-context", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        projectID: researchProjectIDs[0],
        facts: [{ text: "Objects are not valid Project facts." }]
      }
    });
    assert(
      invalidProjectContext.response.status === 400,
      "Research Project context accepted a non-text fact."
    );
    const initialProjectContext = await request("/research/conversations/project-context", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        projectID: researchProjectIDs[0],
        facts: [
          "Existing building is described by the user as Type I-B construction.",
          "The user reports that the building remains occupied during the proposed work."
        ]
      }
    });
    assert(
      initialProjectContext.response.ok &&
        initialProjectContext.json.conversation.projectContext.source === "user-provided" &&
        initialProjectContext.json.conversation.projectContext.facts.length === 2,
      "Research Project context was not stored as explicitly user-provided, non-authoritative context."
    );

    const listedConversations = await request("/research/conversations/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      listedConversations.response.ok && listedConversations.json.conversations.some((item) => item.id === conversationID),
      "Private research history did not list the new conversation."
    );

    const conversationMessage = await request("/research/conversations/message", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        question: "When must the owner notify the department?"
      }
    });
    assert(conversationMessage.response.ok, "Research conversation message failed in mock mode.");
    assert(conversationMessage.json.usage.mockMode === true, "Mock research did not disclose its zero-call mode.");
    assert(
      conversationMessage.json.conversation.messages.length === 2 &&
        conversationMessage.json.conversation.messages[1].answer.citations[0].sectionID === "8881" &&
        conversationMessage.json.conversation.messages[1].answer.citations[0].supportingPassages[0].selectedText === selectedResearchText &&
        conversationMessage.json.conversation.messages[1].answer.evidenceSourceIDs.length === 1,
      "Research conversation did not persist a cited user and assistant exchange."
    );
    assert(
      !JSON.stringify(conversationMessage.json).includes(privateEvaluationSentinel),
      "An ordinary research response exposed private evaluation material."
    );
    const answerID = conversationMessage.json.conversation.messages[1].id;
    const immutableAnswerList = await request("/research/answers/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, conversationID }
    });
    assert(
      immutableAnswerList.response.ok &&
        immutableAnswerList.json.answers.some((answer) =>
          answer.id === answerID && answer.evidenceCount === 1
        ),
      "The generated Research answer was not stored as an immutable historical record."
    );
    const immutableAnswerRead = await request("/research/answers/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, answerID }
    });
    assert(
      immutableAnswerRead.response.ok &&
        immutableAnswerRead.json.answer.immutable === true &&
        immutableAnswerRead.json.answer.projectID === researchProjectIDs[0] &&
        immutableAnswerRead.json.answer.question === "When must the owner notify the department?" &&
        immutableAnswerRead.json.answer.evidence[0].passageText === selectedResearchText &&
        immutableAnswerRead.json.answer.passageToCitationMapping[0].evidenceSnapshotIDs.length === 1,
      "The historical Research endpoint did not restore the exact stored question, evidence, answer, and citation mapping."
    );
    const workboardPreviewUpload = await request("/workboards/previews/upload?" + new URLSearchParams({
      projectID: researchProjectIDs[0],
      workboardUpdatedAt: "2026-07-24T11:59:00.000Z",
      elementCount: "3"
    }), {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      headers: {
        "content-type": "image/png",
        "x-permitext-user-id": userID
      },
      rawBody: smokePNG
    });
    assert(
      workboardPreviewUpload.response.status === 201 &&
        workboardPreviewUpload.json.preview.elementCount === 3 &&
        workboardPreviewUpload.json.preview.contentHash.length === 64,
      "Saving an immutable flattened Workboard preview failed."
    );
    const workboardPreviewID = workboardPreviewUpload.json.preview.id;
    const projectFoundationWithPreview = await request("/projects/foundation/state", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      projectFoundationWithPreview.response.ok &&
        projectFoundationWithPreview.json.workboardPreview.id === workboardPreviewID &&
        projectFoundationWithPreview.json.workboardPreview.contentHash ===
          workboardPreviewUpload.json.preview.contentHash,
      "The iOS Project Hub foundation response omitted the current Workboard preview."
    );

    const createOrganization = await request("/organizations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        name: "Smoke Permit Studio"
      }
    });
    assert(
      createOrganization.response.status === 201 &&
        createOrganization.json.organization.role === "owner" &&
        createOrganization.json.organization.seats.used === 1,
      "A Pro account could not create its firm workspace and Owner seat."
    );
    const organizationID = createOrganization.json.organization.id;
    const emailBoundInvitation = await request("/organizations/members/invite", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        email: "email-bound@smoke.test",
        role: "viewer"
      }
    });
    assert(emailBoundInvitation.response.status === 201, "Email-bound firm invitation setup failed.");
    const noEmailSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-invite-no-email",
          displayName: "No Email Invite Test"
        }
      }
    });
    assert(noEmailSignIn.response.ok, "No-email invitation test account sign-in failed.");
    const noEmailInvitationAccept = await request("/organizations/invitations/accept", {
      method: "POST",
      token: noEmailSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: noEmailSignIn.json.account.appUserID },
        invitationToken: emailBoundInvitation.json.invitationToken
      }
    });
    assert(
      noEmailInvitationAccept.response.status === 403 &&
        noEmailInvitationAccept.json.code === "ORGANIZATION_INVITATION_EMAIL_MISMATCH",
      "An account without the invited email was allowed to accept an email-bound invitation."
    );
    const revokeEmailBoundInvitation = await request("/organizations/invitations/revoke", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        invitationID: emailBoundInvitation.json.invitation.id
      }
    });
    assert(revokeEmailBoundInvitation.response.ok, "Email-bound invitation cleanup failed.");
    const transferProject = await request("/organizations/projects/transfer", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      transferProject.response.ok &&
        transferProject.json.ownership.owner.organizationID === organizationID &&
        transferProject.json.ownership.storageOwnerUserID === userID &&
        transferProject.json.ownership.originalOwnerUserID === userID,
      "Project transfer did not preserve stable identity, storage ownership, and original attribution."
    );
    const firmControlsDraft = structuredClone(createOrganization.json.organization.firmControls);
    const firmControlsTimestamp = "2026-07-25T12:00:00.000Z";
    firmControlsDraft.tags = [{
      id: "smoke-filing-tag",
      name: "Filing",
      colorHex: "#1267a0",
      status: "active",
      createdAt: firmControlsTimestamp,
      updatedAt: firmControlsTimestamp,
      order: 0
    }];
    firmControlsDraft.projectTagAssignments = {
      [researchProjectIDs[0]]: ["smoke-filing-tag"]
    };
    firmControlsDraft.reportTemplates.push({
      id: "smoke-client-report",
      name: "Client Report",
      description: "Smoke-test firm report presentation.",
      coverLabel: "Client Code Report",
      disclaimers: ["Prepared for the named client only."],
      status: "active",
      createdAt: firmControlsTimestamp,
      updatedAt: firmControlsTimestamp,
      order: 1
    });
    firmControlsDraft.defaultReportTemplateID = "smoke-client-report";
    firmControlsDraft.branding = {
      displayName: "Smoke Permit Studio",
      accentColorHex: "#1267a0",
      website: "https://smoke.test",
      footerText: "Smoke Permit Studio"
    };
    firmControlsDraft.requiredDisclaimers = [
      "Professional judgment remains required."
    ];
    firmControlsDraft.researchAllowance = {
      mode: "per-seat",
      monthlyUnits: 75,
      resetDayUTC: 1,
      authority: "policy-only"
    };
    firmControlsDraft.retentionPolicy = {
      retentionDays: 3_650,
      enforcement: "policy-only",
      automaticDeletionEnabled: true
    };
    const saveFirmControls = await request("/organizations/controls/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        expectedVersion: 1,
        controls: firmControlsDraft
      }
    });
    assert(
      saveFirmControls.response.ok &&
        saveFirmControls.json.organization.firmControls.version === 2 &&
        saveFirmControls.json.organization.firmControls.retentionPolicy.automaticDeletionEnabled === false &&
        saveFirmControls.json.organization.firmControls.administrativeHistory.length === 1 &&
        saveFirmControls.json.organization.firmControls.tags[0].createdAt ===
          saveFirmControls.json.organization.firmControls.tags[0].updatedAt &&
        saveFirmControls.json.organization.firmControls.reportTemplates[1].createdAt ===
          saveFirmControls.json.organization.firmControls.reportTemplates[1].updatedAt &&
        saveFirmControls.json.researchUsage.mode === "per-seat" &&
        saveFirmControls.json.researchUsage.requestsUsed === 0,
      "Owner-only firm standards did not preserve policy-only retention, audit history, or usage state."
    );
    const savedFirmControls = saveFirmControls.json.organization.firmControls;
    const staleFirmControls = await request("/organizations/controls/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        expectedVersion: 1,
        controls: firmControlsDraft
      }
    });
    assert(
      staleFirmControls.response.status === 409 &&
        staleFirmControls.json.code === "FIRM_CONTROLS_VERSION_CONFLICT" &&
        staleFirmControls.json.controls.version === 2,
      "Firm standards optimistic concurrency did not protect the current revision."
    );
    const invalidFirmAssignment = await request("/organizations/controls/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        expectedVersion: 2,
        controls: {
          ...savedFirmControls,
          projectTagAssignments: {
            ...savedFirmControls.projectTagAssignments,
            "outside-firm-project": ["smoke-filing-tag"]
          }
        }
      }
    });
    assert(
      invalidFirmAssignment.response.status === 400 &&
        invalidFirmAssignment.json.code === "INVALID_FIRM_PROJECT_ASSIGNMENT",
      "Firm tags accepted an assignment to a Project outside the organization."
    );

    const sharedViewerSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-shared-viewer",
          email: "viewer@smoke.test",
          displayName: "Smoke Viewer"
        }
      }
    });
    assert(sharedViewerSignIn.response.ok, "Shared Project viewer sign-in failed.");
    const sharedViewerID = sharedViewerSignIn.json.account.appUserID;
    const sharedViewerToken = sharedViewerSignIn.json.account.backendSessionToken;
    const inviteViewer = await request("/organizations/members/invite", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        projectID: researchProjectIDs[0],
        email: "viewer@smoke.test",
        role: "viewer"
      }
    });
    assert(
      inviteViewer.response.status === 201 &&
        inviteViewer.json.invitationToken &&
        !JSON.stringify(inviteViewer.json.invitation).includes("tokenHash"),
      "Project invitation did not return its one-time credential safely."
    );
    const acceptViewer = await request("/organizations/invitations/accept", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        invitationToken: inviteViewer.json.invitationToken
      }
    });
    assert(
      acceptViewer.response.ok &&
        acceptViewer.json.organization.role === "viewer" &&
        acceptViewer.json.organization.accessScope === "project",
      "The invited viewer could not accept project-specific access."
    );
    const viewerCapabilityPull = await request("/sync/pull", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        syncSchemaVersion: 2
      }
    });
    assert(
      viewerCapabilityPull.response.ok &&
        viewerCapabilityPull.json.capabilityContract.capabilities.collaboration.enabled === true &&
        viewerCapabilityPull.json.capabilityContract.capabilities["organization-administration"].enabled === false,
      "Accepted Project access did not enable collaboration without granting firm administration."
    );
    const viewerSnapshot = await request("/organizations/projects/snapshot", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      viewerSnapshot.response.ok &&
        viewerSnapshot.json.access.role === "viewer" &&
        viewerSnapshot.json.access.readOnly === true &&
        viewerSnapshot.json.access.organization.firmControls.updatedByUserID === null &&
        viewerSnapshot.json.access.organization.firmControls.administrativeHistory.length === 0 &&
        Object.keys(
          viewerSnapshot.json.access.organization.firmControls.projectTagAssignments
        ).every((projectID) => projectID === researchProjectIDs[0]) &&
        viewerSnapshot.json.project.projects.length === 1 &&
        viewerSnapshot.json.project.projects[0].id === researchProjectIDs[0] &&
        viewerSnapshot.json.project.workboardPreview.id === workboardPreviewID,
      "The Project viewer did not receive a scoped, read-only snapshot of the transferred Project."
    );
    const viewerWorkboardPreview = await requestBinary("/workboards/previews/read", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        projectID: researchProjectIDs[0],
        previewID: workboardPreviewID
      }
    });
    assert(
      viewerWorkboardPreview.response.ok &&
        viewerWorkboardPreview.body.equals(smokePNG),
      "A Project viewer could not open its authorized private Workboard preview."
    );
    const viewerOrganizationUpdate = await request("/organizations/update", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        organizationID,
        name: "Unauthorized Rename"
      }
    });
    assert(
      [403, 404].includes(viewerOrganizationUpdate.response.status),
      "A Project-only viewer was allowed to administer the firm workspace."
    );
    const viewerFirmControlsUpdate = await request("/organizations/controls/save", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        organizationID,
        expectedVersion: 2,
        controls: savedFirmControls
      }
    });
    assert(
      [403, 404].includes(viewerFirmControlsUpdate.response.status),
      "A Project viewer was allowed to change firm tags, templates, or operating policies."
    );
    const viewerMemberDirectory = await request("/organizations/members/list", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        organizationID
      }
    });
    assert(
      [403, 404].includes(viewerMemberDirectory.response.status),
      "A Project viewer was allowed to read the private firm member directory."
    );
    const viewerNotebookWrite = await request("/notebook/cards/save", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        cardType: "coordination-item",
        title: "Unauthorized viewer edit",
        document: {
          type: "doc",
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: "A viewer must not save this." }]
          }]
        }
      }
    });
    assert(
      viewerNotebookWrite.response.status === 403 &&
        viewerNotebookWrite.json.code === "PROJECT_PERMISSION_REQUIRED",
      "A Project viewer was allowed to author Notebook content."
    );
    const pendingSeatInvitationIDs = [];
    for (let index = 1; index <= 3; index += 1) {
      const seatInvitation = await request("/organizations/members/invite", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          email: `pending-seat-${index}@smoke.test`,
          role: "viewer"
        }
      });
      assert(seatInvitation.response.status === 201, `Pending firm seat ${index} was not reserved.`);
      pendingSeatInvitationIDs.push(seatInvitation.json.invitation.id);
    }
    const fullSeatInvitation = await request("/organizations/members/invite", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        email: "over-seat-limit@smoke.test",
        role: "viewer"
      }
    });
    assert(
      fullSeatInvitation.response.status === 409 &&
        fullSeatInvitation.json.code === "ORGANIZATION_SEAT_LIMIT" &&
        fullSeatInvitation.json.seats.used === 5,
      "Firm seat limits did not count active members and pending invitations."
    );
    const releasePendingSeat = await request("/organizations/invitations/revoke", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        invitationID: pendingSeatInvitationIDs[0]
      }
    });
    assert(
      releasePendingSeat.response.ok &&
        releasePendingSeat.json.invitation.status === "revoked",
      "A pending firm seat could not be released for the collaboration workflow."
    );
    const deactivateViewer = await request("/organizations/members/update", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        projectID: researchProjectIDs[0],
        userID: sharedViewerID,
        status: "deactivated"
      }
    });
    assert(
      deactivateViewer.response.ok &&
        deactivateViewer.json.membership.status === "deactivated",
      "A firm Owner could not deactivate Project-specific access."
    );
    const viewerSnapshotAfterRemoval = await request("/organizations/projects/snapshot", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      viewerSnapshotAfterRemoval.response.status === 404,
      "Deactivating a Project member did not revoke private Project access."
    );
    const sharedEditorSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-shared-editor",
          email: "editor@smoke.test",
          displayName: "Smoke Editor"
        }
      }
    });
    assert(sharedEditorSignIn.response.ok, "Shared Project editor sign-in failed.");
    const sharedEditorID = sharedEditorSignIn.json.account.appUserID;
    const sharedEditorToken = sharedEditorSignIn.json.account.backendSessionToken;
    const inviteEditor = await request("/organizations/members/invite", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        projectID: researchProjectIDs[0],
        email: "editor@smoke.test",
        role: "editor"
      }
    });
    assert(inviteEditor.response.status === 201, "Available firm seat could not invite a Project editor.");
    const acceptEditor = await request("/organizations/invitations/accept", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        invitationToken: inviteEditor.json.invitationToken
      }
    });
    assert(
      acceptEditor.response.ok && acceptEditor.json.organization.role === "editor",
      "The Project editor could not accept access."
    );
    const editorNotebookWrite = await request("/notebook/cards/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        cardType: "coordination-item",
        title: "Shared coordination",
        document: {
          schema: "permitext-notebook-card",
          schemaVersion: 1,
          format: "tiptap-json",
          document: {
            type: "doc",
            content: [{
              type: "paragraph",
              content: [{ type: "text", text: "Coordinate the filing sequence." }]
            }]
          }
        }
      }
    });
    assert(
      editorNotebookWrite.response.status === 201 &&
        editorNotebookWrite.json.card.createdBy === sharedEditorID &&
      editorNotebookWrite.json.card.updatedBy === sharedEditorID &&
      editorNotebookWrite.json.activity.actorUserID === sharedEditorID &&
      editorNotebookWrite.json.activity.owner.organizationID === organizationID,
      `An authorized Project editor could not create attributed organization-owned Notebook content: ${editorNotebookWrite.response.status} ${JSON.stringify(editorNotebookWrite.json)}`
    );
    const editorEvidenceProposal = await request("/organizations/evidence/reviews/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        answerID,
        expectedVersion: 0,
        status: "proposed",
        note: "Selected evidence is ready for professional review."
      }
    });
    assert(
      editorEvidenceProposal.response.status === 201 &&
        editorEvidenceProposal.json.review.status === "proposed" &&
        editorEvidenceProposal.json.review.createdByUserID === sharedEditorID,
      "A Project editor could not propose immutable Research evidence for review."
    );
    const evidenceReviewID = editorEvidenceProposal.json.review.id;
    const editorProjectNote = await request("/projects/collaboration/notes/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        title: "Filing coordination",
        body: "Confirm the filing sequence before the next Project review."
      }
    });
    assert(
      editorProjectNote.response.status === 201 &&
        editorProjectNote.json.note.createdByUserID === sharedEditorID &&
        editorProjectNote.json.note.createdByDisplayName === "Smoke Editor" &&
        editorProjectNote.json.activity.action === "project-note.created" &&
        editorProjectNote.json.activity.owner.organizationID === organizationID,
      `A Project editor could not create an attributed standalone Project note: ${editorProjectNote.response.status} ${JSON.stringify(editorProjectNote.json)}`
    );
    const projectNoteID = editorProjectNote.json.note.id;
    const staleProjectNoteWrite = await request("/projects/collaboration/notes/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        noteID: projectNoteID,
        expectedVersion: 0,
        title: "Stale filing coordination",
        body: "This stale revision must not overwrite the current note."
      }
    });
    assert(
      staleProjectNoteWrite.response.status === 409 &&
        staleProjectNoteWrite.json.code === "PROJECT_NOTE_VERSION_CONFLICT" &&
        staleProjectNoteWrite.json.note.version === 1,
      "Project note optimistic concurrency did not preserve the current revision."
    );
    const deactivateEditor = await request("/organizations/members/update", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        projectID: researchProjectIDs[0],
        userID: sharedEditorID,
        status: "deactivated"
      }
    });
    assert(deactivateEditor.response.ok, "Project editor deactivation failed before reviewer invitation.");
    const sharedReviewerSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-shared-reviewer",
          email: "reviewer@smoke.test",
          displayName: "Smoke Reviewer"
        }
      }
    });
    assert(sharedReviewerSignIn.response.ok, "Shared Project reviewer sign-in failed.");
    const sharedReviewerID = sharedReviewerSignIn.json.account.appUserID;
    const sharedReviewerToken = sharedReviewerSignIn.json.account.backendSessionToken;
    const inviteReviewer = await request("/organizations/members/invite", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        projectID: researchProjectIDs[0],
        email: "reviewer@smoke.test",
        role: "reviewer"
      }
    });
    assert(inviteReviewer.response.status === 201, "Available firm seat could not invite a Project reviewer.");
    const acceptReviewer = await request("/organizations/invitations/accept", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        invitationToken: inviteReviewer.json.invitationToken
      }
    });
    assert(
      acceptReviewer.response.ok && acceptReviewer.json.organization.role === "reviewer",
      "The Project reviewer could not accept access."
    );
    const reviewerEvidenceList = await request("/organizations/evidence/reviews/list", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      reviewerEvidenceList.response.ok &&
        reviewerEvidenceList.json.access.canReview === true &&
        reviewerEvidenceList.json.access.canPropose === false &&
        reviewerEvidenceList.json.reviews.some((review) => review.id === evidenceReviewID),
      "A Project reviewer could not see the editor's evidence proposal with reviewer-only capabilities."
    );
    const reviewerApproval = await request("/organizations/evidence/reviews/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        reviewID: evidenceReviewID,
        answerID,
        expectedVersion: 1,
        status: "approved",
        note: "Evidence set approved for the Project record."
      }
    });
    assert(
      reviewerApproval.response.ok &&
        reviewerApproval.json.review.status === "approved" &&
        reviewerApproval.json.review.reviewedByUserID === sharedReviewerID &&
        reviewerApproval.json.activity.actorUserID === sharedReviewerID,
      "A Project reviewer could not approve the proposed immutable evidence with attribution."
    );
    const reviewerNotebookWrite = await request("/notebook/cards/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        cardType: "review-task",
        title: "Reviewer must not edit",
        document: {
          type: "doc",
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: "Reviewer roles are not content editors." }]
          }]
        }
      }
    });
    assert(
      reviewerNotebookWrite.response.status === 403 &&
        reviewerNotebookWrite.json.code === "PROJECT_PERMISSION_REQUIRED",
      "A Project reviewer was allowed to edit authored Notebook content."
    );
    const reviewerProjectNoteWrite = await request("/projects/collaboration/notes/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        title: "Reviewer must not edit notes",
        body: "Reviewer roles coordinate review without changing authored Project notes."
      }
    });
    assert(
      reviewerProjectNoteWrite.response.status === 403 &&
        reviewerProjectNoteWrite.json.code === "PROJECT_PERMISSION_REQUIRED" &&
        reviewerProjectNoteWrite.json.requiredPermission === "project.note.edit",
      "A Project reviewer was allowed to author standalone Project notes."
    );
    const reviewerMissingFactRequest = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        kind: "missing-project-fact",
        status: "open",
        targetKind: "researchAnswer",
        targetID: answerID,
        title: "Confirm the Project occupancy group",
        body: "The professional record needs this fact before the Research conclusion is relied upon."
      }
    });
    assert(
      reviewerMissingFactRequest.response.status === 201 &&
        reviewerMissingFactRequest.json.thread.createdByUserID === sharedReviewerID &&
        reviewerMissingFactRequest.json.thread.createdByDisplayName === "Smoke Reviewer" &&
        reviewerMissingFactRequest.json.thread.targetID === answerID &&
        reviewerMissingFactRequest.json.activity.action === "review-thread.created",
      `A Project reviewer could not open an attributed missing-information request: ${reviewerMissingFactRequest.response.status} ${JSON.stringify(reviewerMissingFactRequest.json)}`
    );
    const reviewThreadID = reviewerMissingFactRequest.json.thread.id;
    const reactivateEditor = await request("/organizations/members/update", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        projectID: researchProjectIDs[0],
        userID: sharedEditorID,
        status: "active"
      }
    });
    assert(
      reactivateEditor.response.ok &&
        reactivateEditor.json.membership.status === "active",
      "The Project editor could not be restored to answer the reviewer request."
    );
    const editorReviewResponse = await request("/projects/collaboration/comments/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        body: "Occupancy group B is confirmed by the approved Project drawings."
      }
    });
    assert(
      editorReviewResponse.response.status === 201 &&
        editorReviewResponse.json.comment.createdByUserID === sharedEditorID &&
        editorReviewResponse.json.comment.createdByDisplayName === "Smoke Editor" &&
        editorReviewResponse.json.comment.threadID === reviewThreadID &&
        editorReviewResponse.json.activity.action === "review-comment.created",
      "An authorized Project editor could not answer the reviewer request with immutable attribution."
    );
    const reviewerResolution = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 1,
        status: "resolved"
      }
    });
    assert(
      reviewerResolution.response.ok &&
        reviewerResolution.json.thread.status === "resolved" &&
        reviewerResolution.json.thread.resolvedByUserID === sharedReviewerID &&
        reviewerResolution.json.thread.resolvedByDisplayName === "Smoke Reviewer" &&
        reviewerResolution.json.activity.action === "review-thread.status.changed",
      "A Project reviewer could not resolve the answered missing-information request."
    );
    const commentAfterResolution = await request("/projects/collaboration/comments/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        body: "A resolved thread must not accept this additional response."
      }
    });
    assert(
      commentAfterResolution.response.status === 409 &&
        commentAfterResolution.json.code === "REVIEW_THREAD_CLOSED",
      "A resolved review thread accepted another comment."
    );
    const collaborationSnapshot = await request("/organizations/projects/snapshot", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0]
      }
    });
    const collaborationArtifacts = collaborationSnapshot.json.project?.artifacts || [];
    assert(
      collaborationSnapshot.response.ok &&
        collaborationArtifacts.some((artifact) =>
          artifact.envelope.type === "projectNote" &&
          artifact.envelope.id === projectNoteID &&
          artifact.payload.createdByDisplayName === "Smoke Editor"
        ) &&
        collaborationArtifacts.some((artifact) =>
          artifact.envelope.type === "reviewThread" &&
          artifact.envelope.id === reviewThreadID &&
          artifact.payload.status === "resolved"
        ) &&
        collaborationArtifacts.some((artifact) =>
          artifact.envelope.type === "reviewComment" &&
          artifact.payload.threadID === reviewThreadID &&
          artifact.payload.createdByDisplayName === "Smoke Editor"
        ),
      "The shared Project snapshot did not preserve the complete attributed collaboration record."
    );

    const storedWorkboardPreview = await requestBinary("/workboards/previews/read", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0],
        previewID: workboardPreviewID
      }
    });
    assert(
      storedWorkboardPreview.response.ok &&
        storedWorkboardPreview.response.headers.get("content-type") === "image/png" &&
        storedWorkboardPreview.response.headers.get("cache-control") === "private, no-store" &&
        storedWorkboardPreview.body.equals(smokePNG),
      "The flattened Workboard preview was not restored through authenticated private storage."
    );
    const reportOptions = await request("/reports/options", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      reportOptions.response.ok &&
        reportOptions.json.defaultReportTemplateID === "smoke-client-report" &&
        reportOptions.json.templates.some((template) => template.id === "smoke-client-report") &&
        reportOptions.json.tags.some((tag) => tag.id === "smoke-filing-tag") &&
        reportOptions.json.branding.displayName === "Smoke Permit Studio",
      "The Report Studio did not receive the Project's firm template, branding, and tag context."
    );
    const reportSources = await request("/reports/sources/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      reportSources.response.ok &&
        reportSources.json.sources.some((source) =>
          source.kind === "researchAnswer" &&
          source.id === answerID &&
          source.sourceClassification === "ai-assisted"
        ) &&
        reportSources.json.sources.some((source) =>
          source.kind === "workboardPreview" &&
          source.id === workboardPreviewID &&
          source.sourceClassification === "project-material"
        ),
      "The Report Draft could not discover the Project's immutable Research answer and Workboard preview."
    );
    const reportDate = "2026-07-24T12:00:00.000Z";
    const createReportDraft = await request("/reports/drafts/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        title: "Smoke Project Research Report",
        reportDate,
        introduction: "A constrained professional report assembled from approved Project Research.",
        blocks: [
          {
            id: "smoke-report-heading",
            kind: "heading",
            text: "Supported Research"
          },
          {
            id: "smoke-report-answer",
            kind: "researchAnswer",
            sourceID: answerID,
            label: "When must the owner notify the department?"
          },
          {
            id: "smoke-report-workboard",
            kind: "workboardPreview",
            sourceID: workboardPreviewID,
            label: "Workboard preview"
          }
        ]
      }
    });
    assert(
      createReportDraft.response.status === 201 &&
        createReportDraft.json.draft.version === 1 &&
        createReportDraft.json.draft.blocks.length === 3,
      "Creating a versioned Report Draft failed."
    );
    const reportDraftID = createReportDraft.json.draft.id;
    const staleReportDraft = await request("/reports/drafts/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0],
        draftID: reportDraftID,
        expectedVersion: 0,
        title: "Stale Report Draft",
        reportDate,
        blocks: createReportDraft.json.draft.blocks
      }
    });
    assert(
      staleReportDraft.response.status === 409 &&
        staleReportDraft.json.code === "REPORT_DRAFT_VERSION_CONFLICT" &&
        staleReportDraft.json.draft.version === 1,
      "The Report Draft accepted a stale explicit revision."
    );
    const generatedProjectReport = await request("/reports/generate", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0],
        draftID: reportDraftID,
        reportTemplateID: "smoke-client-report"
      }
    });
    assert(
      generatedProjectReport.response.status === 201 &&
        generatedProjectReport.json.manifest.immutable === true &&
        generatedProjectReport.json.manifest.reportVersion === 1 &&
        generatedProjectReport.json.manifest.presentation.firmControlsVersion === 2 &&
        generatedProjectReport.json.manifest.presentation.template.id === "smoke-client-report" &&
        generatedProjectReport.json.manifest.presentation.branding.displayName === "Smoke Permit Studio" &&
        generatedProjectReport.json.manifest.disclaimers.includes("Professional judgment remains required.") &&
        generatedProjectReport.json.manifest.disclaimers.includes("Prepared for the named client only.") &&
        generatedProjectReport.json.manifest.items.some((item) =>
          item.kind === "researchAnswer" &&
          item.answerID === answerID &&
          item.sourceClassification === "ai-assisted" &&
          item.evidence.length === 1
        ) &&
        generatedProjectReport.json.manifest.items.some((item) =>
          item.kind === "workboardPreview" &&
          item.sourceID === workboardPreviewID &&
          item.sourceClassification === "project-material"
        ) &&
        generatedProjectReport.json.generatedReport.outputFormats.includes("web-pdf") &&
        generatedProjectReport.json.generatedReport.file.format === "web-pdf" &&
        generatedProjectReport.json.generatedReport.file.size > 2_000 &&
        generatedProjectReport.json.generatedReport.file.contentHash.length === 64 &&
        generatedProjectReport.json.activity.action === "report.generated",
      "Generating an immutable cross-platform Report Manifest failed."
    );
    const reportManifestID = generatedProjectReport.json.manifest.id;
    const webGeneratedReportID = generatedProjectReport.json.generatedReport.id;
    const revisedFirmControls = structuredClone(savedFirmControls);
    revisedFirmControls.branding.displayName = "Smoke Permit Studio Revised";
    revisedFirmControls.reportTemplates = revisedFirmControls.reportTemplates.map((template) =>
      template.id === "smoke-client-report"
        ? { ...template, coverLabel: "Revised Future Report" }
        : template
    );
    const reviseFirmControls = await request("/organizations/controls/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        expectedVersion: 2,
        controls: revisedFirmControls
      }
    });
    assert(
      reviseFirmControls.response.ok &&
        reviseFirmControls.json.organization.firmControls.version === 3 &&
        reviseFirmControls.json.organization.firmControls.administrativeHistory.length === 2,
      "A later firm-standards revision did not preserve its bounded administrative audit history."
    );
    const unauthorizedReportPDF = await request("/reports/files/read", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0],
        generatedReportID: webGeneratedReportID
      }
    });
    assert(
      unauthorizedReportPDF.response.status === 401,
      "Private Report PDF access allowed a missing session token."
    );
    const storedWebPDF = await requestBinary("/reports/files/read", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0],
        generatedReportID: webGeneratedReportID
      }
    });
    assert(
      storedWebPDF.response.ok &&
        storedWebPDF.response.headers.get("content-type") === "application/pdf" &&
        storedWebPDF.response.headers.get("cache-control") === "private, no-store" &&
        storedWebPDF.body.subarray(0, 5).toString("ascii") === "%PDF-" &&
        storedWebPDF.body.subarray(-1_024).toString("ascii").includes("%%EOF"),
      "The generated Web PDF was not restored through authenticated private storage."
    );
    const uploadedIOSPDF = await request("/reports/files/upload?" + new URLSearchParams({
      projectID: researchProjectIDs[0],
      manifestID: reportManifestID,
      format: "ios-pdf"
    }), {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      headers: {
        "content-type": "application/pdf",
        "x-permitext-user-id": userID
      },
      rawBody: storedWebPDF.body
    });
    assert(
      uploadedIOSPDF.response.status === 201 &&
        uploadedIOSPDF.json.file.format === "ios-pdf" &&
      uploadedIOSPDF.json.file.contentHash.length === 64 &&
        uploadedIOSPDF.json.activity.action === "report.export.saved",
      `Saving a native iOS Report rendition to private storage failed: ${uploadedIOSPDF.response.status} ${uploadedIOSPDF.text}`
    );
    const reportHistory = await request("/reports/history/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      reportHistory.response.ok &&
        reportHistory.json.reports[0].id === reportManifestID &&
        reportHistory.json.reports[0].files.some((file) => file.format === "web-pdf") &&
        reportHistory.json.reports[0].files.some((file) => file.format === "ios-pdf") &&
        reportHistory.json.reports[0].contentHash ===
          generatedProjectReport.json.manifest.contentHash,
      "Immutable Report history did not preserve the generated manifest."
    );
    const readReportManifest = await request("/reports/manifests/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        manifestID: reportManifestID
      }
    });
    assert(
      readReportManifest.response.ok &&
        readReportManifest.json.files.length === 2 &&
        readReportManifest.json.manifest.contentHash ===
          generatedProjectReport.json.manifest.contentHash &&
        readReportManifest.json.manifest.presentation.firmControlsVersion === 2 &&
        readReportManifest.json.manifest.presentation.template.coverLabel === "Client Code Report" &&
        readReportManifest.json.manifest.presentation.branding.displayName === "Smoke Permit Studio" &&
        readReportManifest.json.manifest.items.some((item) =>
          item.kind === "researchAnswer" &&
          item.question === "When must the owner notify the department?"
        ) &&
        readReportManifest.json.manifest.items.some((item) =>
          item.kind === "workboardPreview" &&
          item.sourceID === workboardPreviewID
        ),
      "The Report Manifest endpoint did not restore the immutable semantic snapshot."
    );
    const clearWorkboardPreview = await request("/workboards/previews/clear", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      clearWorkboardPreview.response.ok &&
        clearWorkboardPreview.json.clearedCount === 1,
      "Clearing the Project's active Workboard preview failed."
    );
    const reportSourcesAfterPreviewClear = await request("/reports/sources/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      reportSourcesAfterPreviewClear.response.ok &&
        !reportSourcesAfterPreviewClear.json.sources.some((source) =>
          source.kind === "workboardPreview"
        ),
      "A cleared Workboard preview remained available to new Report Drafts."
    );
    const historicalWorkboardPreview = await requestBinary("/workboards/previews/read", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0],
        previewID: workboardPreviewID
      }
    });
    assert(
      historicalWorkboardPreview.response.ok &&
        historicalWorkboardPreview.body.equals(smokePNG),
      "Clearing the active Workboard preview broke an immutable historical Report source."
    );
    const moveResearchWithoutReview = await request("/research/conversations/assign-project", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        projectID: researchProjectIDs[1]
      }
    });
    assert(
      moveResearchWithoutReview.response.status === 409 &&
        moveResearchWithoutReview.json.code === "RESEARCH_PROJECT_REVIEW_REQUIRED",
      "Research moved between Projects without an explicit context-review confirmation."
    );
    const moveResearchWithReview = await request("/research/conversations/assign-project", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        projectID: researchProjectIDs[1],
        confirmMove: true
      }
    });
    assert(
      moveResearchWithReview.response.ok &&
        moveResearchWithReview.json.conversation.primaryProjectID === researchProjectIDs[1] &&
        moveResearchWithReview.json.conversation.projectContextReviewRequired === true &&
        moveResearchWithReview.json.conversation.projectContext.facts.length === 0,
      "Confirmed Research movement did not clear Project facts and require a context review."
    );
    const blockedResearchBeforeContextReview = await request("/research/conversations/message", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        question: "Can I continue before reviewing the new Project context?"
      }
    });
    assert(
      blockedResearchBeforeContextReview.response.status === 409 &&
        blockedResearchBeforeContextReview.json.code === "RESEARCH_PROJECT_REVIEW_REQUIRED",
      "Research generated a new answer before the moved conversation's Project context was reviewed."
    );
    const reviewedMovedProjectContext = await request("/research/conversations/project-context", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        projectID: researchProjectIDs[1],
        facts: ["The user reports that Research Beta concerns a separate occupied building."]
      }
    });
    assert(
      reviewedMovedProjectContext.response.ok &&
        reviewedMovedProjectContext.json.conversation.projectContextReviewRequired === false &&
        reviewedMovedProjectContext.json.activity.action === "research.project-context.reviewed",
      "Reviewing moved Project context did not unblock the Research conversation with meaningful activity."
    );
    const immutableAnswerAfterMove = await request("/research/answers/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, answerID }
    });
    assert(
      immutableAnswerAfterMove.response.ok &&
        immutableAnswerAfterMove.json.answer.projectID === researchProjectIDs[0] &&
        immutableAnswerAfterMove.json.answer.evidence[0].passageText === selectedResearchText,
      "Moving a Research conversation silently reclassified its historical answer or evidence."
    );
    const reusedResearchEvidence = await request("/research/conversations/reuse-evidence", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        answerID,
        projectID: researchProjectIDs[1]
      }
    });
    assert(
      reusedResearchEvidence.response.status === 201 &&
        reusedResearchEvidence.json.conversation.primaryProjectID === researchProjectIDs[1] &&
        reusedResearchEvidence.json.conversation.messages.length === 0 &&
        reusedResearchEvidence.json.conversation.origin.answerID === answerID &&
        reusedResearchEvidence.json.conversation.sources[0].id !==
          createdConversation.json.conversation.sources[0].id &&
        !JSON.stringify(reusedResearchEvidence.json.conversation).includes("When must the owner notify the department?"),
      "Reusing approved evidence did not create a fresh Project-linked conversation with new evidence identities."
    );
    const researchUsage = await request("/research/usage", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      researchUsage.response.ok &&
        researchUsage.json.usage.requestsUsed === 0 &&
        researchUsage.json.usage.resetDate &&
        researchUsage.json.usage.evidenceDiscoveryEnabled === true,
      "Research usage did not expose the monthly allowance and reset date."
    );
    const evaluationCasesBeforeFeedback = await readFile(
      join(evaluationRoot, "research-cases.json"),
      "utf8"
    );
    const evaluationReviewsBeforeFeedback = await readFile(
      join(evaluationRoot, "reviews.json"),
      "utf8"
    );
    const invalidFeedbackRole = await request("/research/feedback", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        answerID,
        category: "citation_problem",
        professionalRole: "unverified_super_expert"
      }
    });
    assert(invalidFeedbackRole.response.status === 400, "Research feedback accepted an unknown professional role.");
    const researchFeedback = await request("/research/feedback", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        answerID,
        category: "citation_problem",
        comment: "The cited passage needs review.",
        professionalRole: "architect_designer",
        supportingReference: "BC 1004.1.3 and the selected enacted passage"
      }
    });
    assert(
      researchFeedback.response.status === 201 &&
        researchFeedback.json.feedback.status === "candidate" &&
        researchFeedback.json.feedback.professionalRole === "architect_designer" &&
        researchFeedback.json.feedback.supportingReference === "BC 1004.1.3 and the selected enacted passage",
      "Research feedback was not saved as a human-review candidate."
    );
    assert(
      await readFile(join(evaluationRoot, "research-cases.json"), "utf8") === evaluationCasesBeforeFeedback &&
        await readFile(join(evaluationRoot, "reviews.json"), "utf8") === evaluationReviewsBeforeFeedback &&
        await readFile(new URL("../research-config.mjs", import.meta.url), "utf8") === researchConfigSource,
      "Submitting feedback modified an evaluation case, review decision, prompt, or model configuration."
    );

    const additionalResearchText = "The real time enforcement unit shall monitor all occupied multiple dwellings with valid permits for (i) the alteration of 10 percent or more of the existing floor surface area of the building or (ii) an addition to the building.";
    const addedConversationEvidence = await request("/research/conversations/evidence", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        sectionID: "8881",
        selectedText: `${additionalResearchText} Has note Bookmarked`
      }
    });
    const selectedConversationSources = addedConversationEvidence.json.conversation?.sources.filter((source) => source.kind === "selection") || [];
    assert(
      addedConversationEvidence.response.ok &&
        selectedConversationSources.length === 2 &&
        selectedConversationSources[1].selectedText === additionalResearchText,
      "Current research did not append and clean a later enacted-text selection after an analysis."
    );
    const immutableAnswerAfterEvidenceChange = await request("/research/answers/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, answerID }
    });
    assert(
      immutableAnswerAfterEvidenceChange.response.ok &&
        immutableAnswerAfterEvidenceChange.json.answer.evidence.length === 1 &&
        immutableAnswerAfterEvidenceChange.json.answer.evidence[0].passageText === selectedResearchText,
      "Adding later evidence silently changed a historical Research answer."
    );

    const fetchedConversation = await request("/research/conversations/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, conversationID }
    });
    assert(
      fetchedConversation.response.ok && fetchedConversation.json.conversation.sourceStatus === "current" &&
        fetchedConversation.json.conversation.messages[1].feedback?.category === "citation_problem" &&
        fetchedConversation.json.conversation.messages[1].feedback?.professionalRole === "architect_designer" &&
        fetchedConversation.json.conversation.messages[1].feedback?.supportingReference === "BC 1004.1.3 and the selected enacted passage",
      "Research conversation did not verify its source hash or restore saved answer feedback."
    );

    const internalConsole = await request("/internal");
    assert(internalConsole.response.ok && internalConsole.text.includes("Permitext Console"), "Local owner console did not load.");
    const unauthorizedInternalData = await request("/internal/evaluations/data", {
      method: "POST",
      body: { auth: { accountUserID: userID } }
    });
    assert(unauthorizedInternalData.response.status === 401, "Owner console exposed private evaluation data without a session.");
    const internalData = await request("/internal/evaluations/data", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      internalData.response.ok && internalData.json.dataset.schemaVersion === 3 &&
        internalData.json.feedbackCandidates.some((item) => item.answerID === answerID) &&
        internalData.json.feedbackRecords.some((item) =>
          item.answerID === answerID &&
          item.triageStatus === "new" &&
          item.professionalRole === "architect_designer"
        ) &&
        internalData.json.runReviewStatuses[evaluationRunID].status === "provisional",
      "Owner console data omitted the private evaluation dataset or feedback candidate."
    );
    assert(
      JSON.stringify(internalData.json).includes(privateEvaluationSentinel),
      "The authenticated local owner console could not read its private evaluation fixture."
    );
    assert(
      !JSON.stringify(internalData.json.dataset).includes("The cited passage needs review."),
      "A feedback candidate entered the approved evaluation dataset."
    );
    const privateTriageSentinel = "PRIVATE_TRIAGE_NOTE_MUST_NOT_REACH_CUSTOMERS";
    const unauthorizedFeedbackTriage = await request("/internal/evaluations/feedback/triage", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        feedbackID: researchFeedback.json.feedback.id,
        triageStatus: "reviewing"
      }
    });
    assert(unauthorizedFeedbackTriage.response.status === 401, "Feedback triage accepted a request without a session.");
    const triagedFeedback = await request("/internal/evaluations/feedback/triage", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        feedbackID: researchFeedback.json.feedback.id,
        triageStatus: "evaluation_candidate",
        reviewer: "Smoke owner",
        notes: privateTriageSentinel
      }
    });
    assert(
      triagedFeedback.response.ok &&
        triagedFeedback.json.feedback.status === "candidate" &&
        triagedFeedback.json.feedback.triageStatus === "evaluation_candidate" &&
        triagedFeedback.json.feedback.triageHistory.length === 1,
      "Owner feedback triage did not preserve candidate status or record its decision history."
    );
    assert(
      await readFile(join(evaluationRoot, "research-cases.json"), "utf8") === evaluationCasesBeforeFeedback &&
        await readFile(join(evaluationRoot, "reviews.json"), "utf8") === evaluationReviewsBeforeFeedback &&
        await readFile(new URL("../research-config.mjs", import.meta.url), "utf8") === researchConfigSource,
      "Feedback triage modified an evaluation case, review decision, prompt, or model configuration."
    );
    const conversationAfterTriage = await request("/research/conversations/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, conversationID }
    });
    assert(
      conversationAfterTriage.response.ok &&
        conversationAfterTriage.json.conversation.messages[1].feedback?.status === "candidate" &&
        conversationAfterTriage.json.conversation.messages[1].feedback?.updatedAt === researchFeedback.json.feedback.updatedAt &&
        !JSON.stringify(conversationAfterTriage.json).includes(privateTriageSentinel) &&
        !JSON.stringify(conversationAfterTriage.json).includes("evaluation_candidate"),
      "Private owner triage state leaked into the customer conversation response."
    );
    const internalDataAfterTriage = await request("/internal/evaluations/data", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      internalDataAfterTriage.json.feedbackRecords.some((item) =>
        item.answerID === answerID &&
        item.triageStatus === "evaluation_candidate" &&
        item.triageNotes === privateTriageSentinel
      ),
      "The owner console could not retrieve the saved private triage decision."
    );
    const firstEvaluationCaseID = evaluationRunCases[0].id;
    const approvedOneAnswer = await request("/internal/evaluations/review", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        kind: "run",
        runID: evaluationRunID,
        caseID: firstEvaluationCaseID,
        decision: "approved",
        reviewer: "Smoke owner",
        notes: "Approve one answer only.",
        scoreOverrides: {}
      }
    });
    assert(
      approvedOneAnswer.response.ok &&
        approvedOneAnswer.json.runReviewStatus.status === "provisional" &&
        approvedOneAnswer.json.runReviewStatus.approvedCaseIDs.length === 1 &&
        approvedOneAnswer.json.runReviewStatus.unreviewedCaseIDs.length === evaluationRunCases.length - 1,
      "Approving one case answer incorrectly promoted the entire evaluation run."
    );
    const approvedCaseDefinition = await request("/internal/evaluations/review", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        kind: "case",
        caseID: firstEvaluationCaseID,
        decision: "approved",
        reviewer: "Smoke owner",
        notes: "Case-level review only.",
        scoreOverrides: {}
      }
    });
    assert(approvedCaseDefinition.response.ok, "The owner case-level review fixture failed.");
    const reviewsAfterCaseDecision = JSON.parse(
      await readFile(join(evaluationRoot, "reviews.json"), "utf8")
    ).reviews;
    assert(
      reviewsAfterCaseDecision.filter((review) => review.kind === "run").length === 1 &&
        reviewsAfterCaseDecision.filter((review) => review.kind === "case").length === 1,
      "A case-level approval created or altered a run-level approval."
    );
    const internalDataAfterApprovals = await request("/internal/evaluations/data", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      internalDataAfterApprovals.json.runReviewStatuses[evaluationRunID].status === "provisional",
      "A case-definition mutation made an incompletely reviewed run preferred."
    );
    const feedbackPromotionAttempt = await request("/internal/evaluations/feedback/promote", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, answerID }
    });
    assert(
      !feedbackPromotionAttempt.response.ok,
      "Feedback could be promoted without an explicit implemented owner-review workflow."
    );

    const researchStore = JSON.parse(await readFile(dataPath, "utf8"));
    const storedConversation = researchStore.researchConversationsByUserID[userID].find((item) => item.id === conversationID);
    storedConversation.sources[0].sectionTextHash = "simulated-outdated-source";
    await writeFile(dataPath, `${JSON.stringify(researchStore, null, 2)}\n`);
    const staleConversationMessage = await request("/research/conversations/message", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        question: "Can I rely on the old source?"
      }
    });
    assert(
      staleConversationMessage.response.status === 409 && staleConversationMessage.json.code === "RESEARCH_SOURCE_CHANGED",
      "Research did not stop a new answer after the enacted source hash changed."
    );
    const refreshedConversation = await request("/research/conversations/refresh", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, conversationID }
    });
    assert(
      refreshedConversation.response.ok && refreshedConversation.json.conversation.sourceStatus === "current",
      "Research sources could not be explicitly refreshed after a code update."
    );

    const deletedConversation = await request("/research/conversations/delete", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, conversationID }
    });
    assert(deletedConversation.response.ok && deletedConversation.json.deleted, "Research conversation deletion failed.");
    const deletedConversationRead = await request("/research/conversations/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, conversationID }
    });
    assert(deletedConversationRead.response.status === 404, "Deleted research conversation remained readable.");

    const browserCredentialID = "smoke-browser";
    const browserSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "web",
          providerUserID: browserCredentialID,
          displayName: "Smoke Browser"
        }
      }
    });
    assert(browserSignIn.response.ok, "Browser sign-in failed.");
    const browserGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID: browserSignIn.json.account.appUserID }
    });
    assert(browserGrant.response.ok, "Browser entitlement grant failed.");
    const appleRepairSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "repair-target",
          displayName: "Repair Target"
        }
      }
    });
    assert(appleRepairSignIn.response.ok, "Apple repair target sign-in failed.");
    const browserLink = await request("/account/link-browser", {
      method: "POST",
      token: appleRepairSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: appleRepairSignIn.json.account.appUserID },
        browserCredentialID
      }
    });
    assert(browserLink.response.ok, "Browser account link failed.");
    assert(browserLink.json.entitlement?.grantedUserID === appleRepairSignIn.json.account.appUserID, "Browser entitlement was not transferred to Apple.");
    assert(browserLink.json.mergedAccount?.sourceUserID === browserSignIn.json.account.appUserID, "Browser account link did not report the merged source.");

    const restoreWithoutStripe = await request("/billing/stripe/restore", {
      method: "POST",
      token: appleRepairSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: appleRepairSignIn.json.account.appUserID },
        restoreID: "sub_smoke"
      }
    });
    assert(restoreWithoutStripe.response.status === 503, "Stripe restore should be disabled without Stripe checkout configuration.");

    const portalWithoutStripe = await request("/billing/web/portal", {
      method: "POST",
      token: appleRepairSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: appleRepairSignIn.json.account.appUserID } }
    });
    assert(portalWithoutStripe.response.status === 503, "Stripe portal should be disabled without Stripe checkout configuration.");

    const invalidAppleTokenSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "bad-token-user",
          identityToken: "not-a-jwt"
        }
      }
    });
    assert(invalidAppleTokenSignIn.response.status === 401, "Invalid Apple identity token was accepted.");

    const unsupportedProviderSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "guest",
          providerUserID: "unsupported-provider"
        }
      }
    });
    assert(unsupportedProviderSignIn.response.status === 400, "Unsupported account provider was accepted.");

    const attach = await request("/account/attach-local-data", {
      method: "POST",
      body: { account: signIn.json.account }
    });
    assert(attach.response.ok, "Attach local data failed.");
    assert(attach.json === "localDataAttached", "Attach local data returned the wrong state.");

    const profile = await request("/account/profile", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        publicUsername: "@Smoke-Pro",
        displayName: "Smoke Pro"
      }
    });
    assert(profile.response.ok, "Profile update failed.");
    assert(profile.json.account.publicUsername === "smoke-pro", "Profile update did not persist public username.");

    const attachAfterProfile = await request("/account/attach-local-data", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        account: {
          ...signIn.json.account,
          publicUsername: null,
          displayName: "Stale Local Name"
        }
      }
    });
    assert(attachAfterProfile.response.ok, "Attach local data after profile update failed.");
    const profileAfterAttach = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-user",
          displayName: "Smoke User Reinstall"
        }
      }
    });
    assert(
      profileAfterAttach.json.account.publicUsername === "smoke-pro",
      "Attach local data should not erase the server-owned public username."
    );
    assert(
      profileAfterAttach.json.entitlement?.source === "lifetimeGrant",
      "Re-sign-in did not return the persisted entitlement."
    );

    const secondSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(secondSignIn.response.ok, "Second account sign-in failed.");

    const mergeWebSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "web",
          providerUserID: "merge-web-smoke",
          displayName: "Merge Web"
        }
      }
    });
    assert(mergeWebSignIn.response.ok, "Merge source web sign-in failed.");
    const mergeSourceUserID = mergeWebSignIn.json.account.appUserID;
    const mergeSourceToken = mergeWebSignIn.json.account.backendSessionToken;
    const mergeAppleUserID = "apple:merge-apple-smoke";
    const mergeGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: adminToken,
      body: { userID: mergeSourceUserID }
    });
    assert(mergeGrant.response.ok, "Merge source lifetime grant failed.");
    const mergeSavedMutation = {
      savedItem: {
        id: `${mergeSourceUserID}:saved:nyc-2022:900001`,
        userID: mergeSourceUserID,
        codeVersion: "nyc-2022",
        sectionID: 900001,
        updatedAt: new Date().toISOString()
      }
    };
    const mergeSourcePush = await request("/sync/push", {
      method: "POST",
      token: mergeSourceToken,
      body: {
        auth: { accountUserID: mergeSourceUserID },
        batch: {
          user: { id: mergeSourceUserID },
          mutations: [mergeSavedMutation]
        }
      }
    });
    assert(mergeSourcePush.response.ok, "Merge source push failed.");
    const mergeAppleSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "merge-apple-smoke",
          displayName: "Merge Apple"
        },
        linkFrom: {
          accountUserID: mergeSourceUserID,
          sessionToken: mergeSourceToken
        }
      }
    });
    assert(mergeAppleSignIn.response.ok, "Apple sign-in with linked web account failed.");
    assert(mergeAppleSignIn.json.account.appUserID === mergeAppleUserID, "Merge returned the wrong Apple account.");
    assert(mergeAppleSignIn.json.mergedAccount?.sourceUserID === mergeSourceUserID, "Merge source was not reported.");
    assert(mergeAppleSignIn.json.entitlement?.grantedUserID === mergeAppleUserID, "Merge did not transfer entitlement.");
    const mergeApplePull = await request("/sync/pull", {
      method: "POST",
      token: mergeAppleSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: mergeAppleUserID } }
    });
    assert(mergeApplePull.response.ok, "Merged Apple pull failed.");
    const mergedSaved = mergeApplePull.json.mutations.find((mutation) => mutation.savedItem);
    assert(mergedSaved?.savedItem.userID === mergeAppleUserID, "Merged saved item user ID was not retargeted.");
    assert(
      mergedSaved?.savedItem.id === `${mergeAppleUserID}:saved:${defaultSyncCodeVersion}:900001`,
      "Merged saved item ID was not retargeted."
    );
    const mergeSourcePull = await request("/sync/pull", {
      method: "POST",
      token: mergeSourceToken,
      body: { auth: { accountUserID: mergeSourceUserID } }
    });
    assert(mergeSourcePull.response.status === 401, "Merged source account session still worked.");

    const nativeAppleSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "native-apple-subject",
          email: "shared-apple@example.com",
          displayName: "Native Apple"
        }
      }
    });
    assert(nativeAppleSignIn.response.ok, "Native Apple sign-in failed.");
    const nativeAppleUserID = nativeAppleSignIn.json.account.appUserID;
    const nativeAppleToken = nativeAppleSignIn.json.account.backendSessionToken;
    const nativeAnnotationID = `${nativeAppleUserID}:note:${defaultSyncCodeVersion}:545:rid-0-0-0-164259`;
    const nativeAnnotationPush = await request("/sync/push", {
      method: "POST",
      token: nativeAppleToken,
      body: {
        auth: { accountUserID: nativeAppleUserID },
        batch: {
          user: { id: nativeAppleUserID },
          mutations: [{
            annotation: {
              id: nativeAnnotationID,
              userID: nativeAppleUserID,
              codeVersion: defaultSyncCodeVersion,
              sectionID: 545,
              blockID: "rid-0-0-0-164259",
              noteBody: "Native note",
              updatedAt: new Date().toISOString()
            }
          }]
        }
      }
    });
    assert(nativeAnnotationPush.response.ok, "Native Apple annotation push failed.");
    const webAppleSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "web-apple-subject",
          email: "shared-apple@example.com",
          displayName: "Web Apple"
        }
      }
    });
    assert(webAppleSignIn.response.ok, "Web Apple sign-in failed.");
    assert(webAppleSignIn.json.account.appUserID === nativeAppleUserID, "Web Apple sign-in did not reuse the native Apple account.");
    assert(
      webAppleSignIn.json.account.linkedAppleUserIDs?.includes("web-apple-subject"),
      "Web Apple subject was not linked to the native account."
    );
    const webApplePull = await request("/sync/pull", {
      method: "POST",
      token: webAppleSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: nativeAppleUserID } }
    });
    assert(webApplePull.response.ok, "Web Apple pull failed.");
    assert(
      webApplePull.json.mutations.some((mutation) => mutation.annotation?.noteBody === "Native note"),
      "Web Apple account did not pull the native Apple annotation."
    );

    const webAnnotationUpdatePush = await request("/sync/push", {
      method: "POST",
      token: webAppleSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: nativeAppleUserID },
        batch: {
          user: { id: nativeAppleUserID },
          mutations: [{
            annotation: {
              id: "web-annotation-shared-note",
              userID: nativeAppleUserID,
              codeVersion: "nyc-2022",
              sectionID: 545,
              blockID: "rid-0-0-0-164259",
              noteBody: "Web note",
              updatedAt: new Date(Date.now() + 1_000).toISOString()
            }
          }]
        }
      }
    });
    assert(webAnnotationUpdatePush.response.ok, "Web Apple annotation update failed.");
    assert(
      webAnnotationUpdatePush.json.acceptedMutationIDs.includes(nativeAnnotationID),
      "Web annotation update did not target the native canonical note record."
    );
    const nativeAfterWebAnnotationPull = await request("/sync/pull", {
      method: "POST",
      token: nativeAppleToken,
      body: { auth: { accountUserID: nativeAppleUserID } }
    });
    assert(
      nativeAfterWebAnnotationPull.json.mutations.some((mutation) =>
        mutation.annotation?.id === nativeAnnotationID && mutation.annotation?.noteBody === "Web note"
      ),
      "Native Apple pull did not receive the web note update."
    );

    const webAnnotationClearPush = await request("/sync/push", {
      method: "POST",
      token: webAppleSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: nativeAppleUserID },
        batch: {
          user: { id: nativeAppleUserID },
          mutations: [{
            annotation: {
              id: "web-annotation-shared-note",
              userID: nativeAppleUserID,
              codeVersion: "nyc-2022",
              sectionID: 545,
              blockID: "rid-0-0-0-164259",
              noteBody: "",
              updatedAt: new Date(Date.now() + 2_000).toISOString()
            }
          }]
        }
      }
    });
    assert(webAnnotationClearPush.response.ok, "Web Apple annotation clear failed.");
    const nativeAfterWebClearPull = await request("/sync/pull", {
      method: "POST",
      token: nativeAppleToken,
      body: { auth: { accountUserID: nativeAppleUserID } }
    });
    assert(
      nativeAfterWebClearPull.json.mutations.some((mutation) =>
        mutation.annotation?.id === nativeAnnotationID && mutation.annotation?.noteBody === ""
      ),
      "Native Apple pull did not receive the web note removal."
    );

    const nativeAppleGrant = await request("/admin/lifetime-grants/grant", {
      method: "POST",
      token: grantAdminToken,
      body: { userID: nativeAppleUserID }
    });
    assert(nativeAppleGrant.response.ok, "Native Apple Pro grant failed before the cross-device tag test.");

    const nativeTagID = `${nativeAppleUserID}:tags:${defaultSyncCodeVersion}:545:rid-0-0-0-164259`;
    const webTagPush = await request("/sync/push", {
      method: "POST",
      token: webAppleSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: nativeAppleUserID },
        batch: {
          user: { id: nativeAppleUserID },
          mutations: [{
            annotation: {
              id: "web-annotation-shared-tags",
              userID: nativeAppleUserID,
              codeVersion: "nyc-2022",
              sectionID: 545,
              blockID: "rid-0-0-0-164259",
              tags: ["Cross Device"],
              updatedAt: new Date(Date.now() + 3_000).toISOString()
            }
          }]
        }
      }
    });
    assert(webTagPush.response.ok, "Web Apple tag update failed.");
    assert(webTagPush.json.acceptedMutationIDs.includes(nativeTagID), "Web tags did not use the native canonical tag record.");
    const nativeAfterWebTagPull = await request("/sync/pull", {
      method: "POST",
      token: nativeAppleToken,
      body: { auth: { accountUserID: nativeAppleUserID } }
    });
    assert(
      nativeAfterWebTagPull.json.mutations.some((mutation) =>
        mutation.annotation?.id === nativeTagID && mutation.annotation?.tags?.includes("Cross Device")
      ),
      "Native Apple pull did not receive the web tag update."
    );

    const clientEntitlementPush = await request("/sync/push", {
      method: "POST",
      token: secondSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        batch: {
          user: { id: "apple:second-smoke-user" },
          entitlement: {
            plan: "pro",
            source: "webSubscription",
            grantedUserID: "apple:second-smoke-user"
          },
          mutations: []
        }
      }
    });
    assert(clientEntitlementPush.response.ok, "Push with client entitlement failed.");
    assert(clientEntitlementPush.json.entitlement === null, "Push accepted a client-provided entitlement.");

    const secondSignInAfterClientEntitlement = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(
      secondSignInAfterClientEntitlement.json.entitlement === null,
      "Client-provided entitlement persisted after sign-in."
    );

    const freeProjectRecordID = `apple:second-smoke-user:project:${defaultSyncCodeVersion}:free-project-smoke`;
    const freeProjectMutation = {
      project: {
        id: "free-project-smoke",
        userID: "apple:second-smoke-user",
        codeVersion: defaultSyncCodeVersion,
        clientID: "free-project-smoke",
        name: "Free Project Attempt",
        updatedAt: new Date().toISOString()
      }
    };
    const freeProjectPush = await request("/sync/push", {
      method: "POST",
      token: secondSignInAfterClientEntitlement.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        batch: {
          user: { id: "apple:second-smoke-user" },
          mutations: [freeProjectMutation]
        }
      }
    });
    assert(freeProjectPush.response.ok, "Free project enforcement request failed.");
    assert(
      freeProjectPush.json.rejectedMutationIDs.includes(freeProjectRecordID) &&
        freeProjectPush.json.rejectionReasons[freeProjectRecordID]?.code === "PRO_REQUIRED_PROJECTS",
      "The server accepted a new Project from a Free account."
    );

    const stripeCheckoutEvent = JSON.stringify({
      id: "evt_smoke_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_smoke",
          mode: "subscription",
          client_reference_id: "apple:second-smoke-user",
          customer: "cus_smoke",
          subscription: "sub_smoke",
          metadata: { accountUserID: "apple:second-smoke-user" }
        }
      }
    });
    const invalidStripeWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=bad"
      },
      rawBody: stripeCheckoutEvent
    });
    assert(invalidStripeWebhook.response.status === 400, "Stripe webhook accepted an invalid signature.");

    const stripeCheckoutWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignature(stripeCheckoutEvent, stripeWebhookSecret)
      },
      rawBody: stripeCheckoutEvent
    });
    assert(stripeCheckoutWebhook.response.ok, "Stripe checkout webhook failed.");

    const proProjectPush = await request("/sync/push", {
      method: "POST",
      token: secondSignInAfterClientEntitlement.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        batch: {
          user: { id: "apple:second-smoke-user" },
          mutations: [{
            project: {
              ...freeProjectMutation.project,
              updatedAt: new Date(Date.now() + 1_000).toISOString()
            }
          }]
        }
      }
    });
    assert(
      proProjectPush.response.ok && proProjectPush.json.acceptedMutationIDs.includes(freeProjectRecordID),
      "An active Pro entitlement did not unlock Project sync."
    );
    assert(stripeCheckoutWebhook.json.changed === true, "Stripe checkout webhook did not update entitlement.");

    const secondSignInAfterStripeWebhook = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(
      secondSignInAfterStripeWebhook.json.entitlement?.source === "webSubscription",
      "Stripe checkout webhook did not grant web subscription entitlement."
    );
    const secondPullAfterStripeWebhook = await request("/sync/pull", {
      method: "POST",
      token: secondSignInAfterStripeWebhook.json.account.backendSessionToken,
      body: { auth: { accountUserID: "apple:second-smoke-user" } }
    });
    assert(
      secondPullAfterStripeWebhook.json.entitlement?.source === "webSubscription",
      "Sync pull did not return the web subscription entitlement."
    );

    const stripeDeletedEvent = JSON.stringify({
      id: "evt_smoke_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_smoke",
          status: "canceled",
          customer: "cus_smoke"
        }
      }
    });
    const stripeDeletedWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignature(stripeDeletedEvent, stripeWebhookSecret)
      },
      rawBody: stripeDeletedEvent
    });
    assert(stripeDeletedWebhook.response.ok, "Stripe subscription delete webhook failed.");
    assert(stripeDeletedWebhook.json.changed === true, "Stripe subscription delete did not update entitlement.");

    const secondSignInAfterStripeDelete = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "second-smoke-user",
          displayName: "Second Smoke User"
        }
      }
    });
    assert(
      secondSignInAfterStripeDelete.json.entitlement === null,
      "Stripe subscription delete did not revoke web subscription entitlement."
    );

    const crossAccountProfile = await request("/account/profile", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        publicUsername: "wrong-token-profile"
      }
    });
    assert(crossAccountProfile.response.status === 401, "Profile update allowed another account's session token.");

    const crossAccountPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        batch: {
          user: { id: "apple:second-smoke-user" },
          mutations: []
        }
      }
    });
    assert(crossAccountPush.response.status === 401, "Push allowed another account's session token.");

    const crossAccountPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: "apple:second-smoke-user" } }
    });
    assert(crossAccountPull.response.status === 401, "Pull allowed another account's session token.");

    const duplicateProfile = await request("/account/profile", {
      method: "POST",
      token: secondSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        publicUsername: "smoke-pro"
      }
    });
    assert(duplicateProfile.response.status === 409, "Profile update allowed a duplicate public username.");

    const invalidProfile = await request("/account/profile", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        publicUsername: "bad name"
      }
    });
    assert(invalidProfile.response.status === 400, "Profile update allowed an invalid public username.");

    const unlinkedPasskeySignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: "unlinked-passkey"
        }
      }
    });
    assert(unlinkedPasskeySignIn.response.status === 410, "Passkey sign-in was not disabled.");

    const passkeyCredentialID = "smoke-passkey-credential";
    const passkeyLink = await request("/account/passkeys/link", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        credentialID: passkeyCredentialID,
        account: signIn.json.account
      }
    });
    assert(passkeyLink.response.status === 410, "Passkey registration was not disabled.");

    const passkeySignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: passkeyCredentialID
        }
      }
    });
    assert(passkeySignIn.response.status === 410, "A disabled passkey credential was accepted.");

    const legacyStore = JSON.parse(await readFile(dataPath, "utf8"));
    legacyStore.users["passkey:legacy-bad-account"] = {
      appUserID: "passkey:legacy-bad-account",
      authProvider: "passkey",
      authProviderUserID: "legacy-bad-account",
      displayName: "Legacy Bad Account"
    };
    legacyStore.sessions["passkey:legacy-bad-account"] = "legacy-session";
    legacyStore.entitlements["passkey:legacy-bad-account"] = {
      plan: "pro",
      source: "subscription"
    };
    legacyStore.passkeyCredentials["legacy-bad-credential"] = "passkey:legacy-bad-account";
    legacyStore.mutationsByUserID["passkey:legacy-bad-account"] = [{
      savedItem: {
        id: "legacy-bad-saved-item",
        userID: "passkey:legacy-bad-account",
        codeVersion: "nyc-2022",
        sectionID: 202,
        createdAt: "2026-06-05T00:00:00Z",
        updatedAt: "2026-06-05T00:00:00Z"
      }
    }];
    await writeFile(dataPath, JSON.stringify(legacyStore, null, 2) + "\n");

    const unauthorizedLegacyCleanup = await request("/admin/accounts/delete-legacy-passkey-users", {
      method: "POST"
    });
    assert(unauthorizedLegacyCleanup.response.status === 401, "Legacy passkey cleanup allowed an unauthenticated request.");

    const legacyCleanup = await request("/admin/accounts/delete-legacy-passkey-users", {
      method: "POST",
      token: adminToken
    });
    assert(legacyCleanup.response.ok, "Legacy passkey cleanup failed.");
    assert(legacyCleanup.json.deletedCount === 1, "Legacy passkey cleanup deleted the wrong number of users.");
    assert(
      legacyCleanup.json.deletedUserIDs.includes("passkey:legacy-bad-account"),
      "Legacy passkey cleanup did not report the deleted user."
    );

    const legacyPasskeyAfterCleanup = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "passkey",
          providerUserID: "legacy-bad-credential"
        }
      }
    });
    assert(legacyPasskeyAfterCleanup.response.status === 410, "Legacy passkey sign-in was not disabled.");

    const unauthorizedPush = await request("/sync/push", {
      method: "POST",
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: []
        }
      }
    });
    assert(unauthorizedPush.response.status === 401, "Push allowed a missing session token.");

    const malformedPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{ unknown: { id: "bad", userID, updatedAt: "2026-06-04T00:00:00Z" } }]
        }
      }
    });
    assert(malformedPush.response.status === 400, "Push accepted an unsupported mutation kind.");

    const oversizedPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: Array.from({ length: 101 }, () => ({})) }
      }
    });
    assert(oversizedPush.response.status === 413, "Push accepted an oversized mutation batch.");

    const mismatchedUserPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: "apple:wrong-user" },
          mutations: []
        }
      }
    });
    assert(mismatchedUserPush.response.status === 400, "Push accepted a mismatched batch user.");

    const mutation = {
      savedItem: {
        id: "saved-smoke",
        userID,
        codeVersion: "2022 Construction Codes",
        sectionID: 900001,
        createdAt: "2026-06-04T00:00:00Z",
        updatedAt: "2026-06-04T00:00:00Z"
      }
    };
    const savedSmokeRecordID = `${userID}:saved:${defaultSyncCodeVersion}:900001`;
    const push = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [mutation]
        }
      }
    });
    assert(push.response.ok, "Sync push failed.");
    assert(
      push.json.acceptedMutationIDs.includes(savedSmokeRecordID),
      "Push did not canonicalize the iOS code-version name."
    );
    assert(Number.isInteger(push.json.latestEventID), "Push did not return a latest event ID.");
    assert(push.json.syncRevision === push.json.latestEventID, "Push sync revision did not match latest event ID.");

    const stalePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            savedItem: {
              ...mutation.savedItem,
              updatedAt: "2026-06-03T00:00:00Z"
            }
          }]
        }
      }
    });
    assert(stalePush.response.ok, "Stale push should report rejection without failing the request.");
    assert(!stalePush.json.acceptedMutationIDs.includes(savedSmokeRecordID), "Stale push was accepted.");
    assert(stalePush.json.rejectedMutationIDs.includes(savedSmokeRecordID), "Stale push was not reported as rejected.");

    const pull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(pull.response.ok, "Sync pull failed.");
    assert(Number.isInteger(pull.json.latestEventID), "Pull did not return a latest event ID.");
    assert(pull.json.syncRevision === pull.json.latestEventID, "Pull sync revision did not match latest event ID.");
    assert(pull.json.contentMapVersion === 2, "Pull did not return the canonical content-map version.");
    assert(
      pull.json.mutations.some((item) => item.savedItem?.sectionID === 900001),
      "Pull did not return the pushed mutation."
    );

    const invalidInlineWorkboardPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            workboard: {
              id: "invalid-inline-workboard",
              userID,
              codeVersion: "nyc-2022",
              projectID: "project-client-smoke",
              elements: [],
              appState: {},
              files: { image: { dataURL: "data:image/png;base64,AA==" } },
              assets: {},
              updatedAt: "2026-06-04T00:10:00Z"
            }
          }]
        }
      }
    });
    assert(invalidInlineWorkboardPush.response.status === 400, "Workboard push accepted inline image data.");

    const workboardMutation = {
      workboard: {
        id: "local-workboard-id",
        userID,
        codeVersion: "nyc-2022",
        projectID: "project-client-smoke",
        projectName: "Smoke Project",
        elements: [{ id: "rectangle-smoke", type: "rectangle" }],
        appState: { viewBackgroundColor: "#ffffff" },
        files: {},
        assets: {},
        updatedAt: "2026-06-04T00:20:00Z"
      }
    };
    const canonicalWorkboardRecordID = `${userID}:workboard:project-client-smoke`;
    const workboardPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: [workboardMutation] }
      }
    });
    assert(workboardPush.response.ok, "Workboard sync push failed.");
    assert(
      workboardPush.json.acceptedMutationIDs.includes(canonicalWorkboardRecordID),
      "Workboard sync did not use its canonical project-scoped ID."
    );

    const workboardPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const pulledWorkboard = workboardPull.json.mutations.find((item) =>
      item.workboard?.id === canonicalWorkboardRecordID
    )?.workboard;
    assert(pulledWorkboard?.elements?.[0]?.id === "rectangle-smoke", "Workboard pull omitted drawing elements.");
    assert(!Object.values(pulledWorkboard.files || {}).some((file) => file.dataURL), "Workboard pull exposed inline image data.");

    const unauthorizedAssetUpload = await request("/workboards/assets/upload?projectID=project-client-smoke&fileID=image-smoke", {
      method: "POST",
      headers: {
        "content-type": "image/png",
        "x-permitext-user-id": userID
      },
      rawBody: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    });
    assert(unauthorizedAssetUpload.response.status === 401, "Workboard asset upload allowed a missing session token.");

    const unconfiguredAssetUpload = await request("/workboards/assets/upload?projectID=project-client-smoke&fileID=image-smoke", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      headers: {
        "content-type": "image/png",
        "x-permitext-user-id": userID
      },
      rawBody: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    });
    assert(unconfiguredAssetUpload.response.status === 503, "Workboard asset upload did not report missing private Blob storage.");

    const forgedAssetDelete = await request("/workboards/assets/delete", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        pathnames: ["workboards/another-user/another-project/image.png"]
      }
    });
    assert(forgedAssetDelete.response.status === 403, "Workboard asset deletion accepted another project's pathname.");

    const webSavedMutation = {
      savedItem: {
        id: "web-saved-202",
        userID,
        codeVersion: "nyc-2022",
        codePrefix: "BC",
        chapterNumber: "2",
        sectionID: 202,
        sectionNumber: "202",
        title: "Definitions",
        updatedAt: "2026-06-04T01:00:00Z"
      }
    };
    const webSavePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [webSavedMutation]
        }
      }
    });
    const canonicalSavedRecordID = `${userID}:saved:${defaultSyncCodeVersion}:113`;
    assert(webSavePush.response.ok, "Web-style saved push failed.");
    assert(
      webSavePush.json.acceptedMutationIDs.includes(canonicalSavedRecordID),
      "Web-style saved push was not normalized to the shared saved record ID."
    );

    const iosAfterWebSavePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(iosAfterWebSavePull.response.ok, "iOS pull after web save failed.");
    assert(
      iosAfterWebSavePull.json.mutations.some((item) =>
        item.savedItem?.id === canonicalSavedRecordID &&
        item.savedItem?.sectionID === 113 &&
        item.savedItem?.title === "Definitions" &&
        !item.savedItem?.deletedAt
      ),
      "iOS pull did not receive the web-created saved section and its title."
    );

    const zoningSavedRecordID = `${userID}:saved:${zoningSyncCodeVersion}:20018521`;
    const zoningNoteRecordID = `${userID}:note:${zoningSyncCodeVersion}:20018521`;
    const zoningContentPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [
            {
              savedItem: {
                id: "ios-zoning-saved-20018521",
                userID,
                codeVersion: "NYC Zoning Resolution — text through 2026-07-16",
                codePrefix: "ZR",
                chapterNumber: "I-2",
                sectionID: 20_018_521,
                sectionNumber: "12-01",
                title: "Rules Applying to Text of Resolution",
                updatedAt: "2026-06-04T01:15:00Z"
              }
            },
            {
              annotation: {
                id: "ios-zoning-note-20018521",
                userID,
                codeVersion: "NYC Zoning Resolution",
                codePrefix: "ZR",
                chapterNumber: "I-2",
                sectionID: 20_018_521,
                sectionNumber: "12-01",
                noteBody: "Verify this zoning rule with the project record.",
                updatedAt: "2026-06-04T01:16:00Z"
              }
            }
          ]
        }
      }
    });
    assert(zoningContentPush.response.ok, "iOS-style Zoning save and note push failed.");
    assert(zoningContentPush.json.acceptedMutationIDs.includes(zoningSavedRecordID));
    assert(zoningContentPush.json.acceptedMutationIDs.includes(zoningNoteRecordID));
    const zoningContentPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      zoningContentPull.response.ok &&
        zoningContentPull.json.mutations.some((item) =>
          item.savedItem?.id === zoningSavedRecordID &&
          item.savedItem?.codeVersion === zoningSyncCodeVersion
        ) &&
        zoningContentPull.json.mutations.some((item) =>
          item.annotation?.id === zoningNoteRecordID &&
          item.annotation?.noteBody === "Verify this zoning rule with the project record."
        ),
      "Zoning Saved and Notes did not round-trip with a canonical cross-device identity."
    );

    const iosDeleteMutation = {
      savedItem: {
        id: canonicalSavedRecordID,
        userID,
        codeVersion: "nyc-2022",
        sectionID: 113,
        updatedAt: "2026-06-04T02:00:00Z",
        deletedAt: "2026-06-04T02:00:00Z"
      }
    };
    const iosDeletePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [iosDeleteMutation]
        }
      }
    });
    assert(iosDeletePush.response.ok, "iOS delete push failed.");
    assert(
      iosDeletePush.json.acceptedMutationIDs.includes(canonicalSavedRecordID),
      "iOS delete did not replace the web save record."
    );

    const webAfterIOSDeletePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(webAfterIOSDeletePull.response.ok, "Web pull after iOS delete failed.");
    const deletedSavedRecord = webAfterIOSDeletePull.json.mutations.find((item) =>
      item.savedItem?.id === canonicalSavedRecordID
    )?.savedItem;
    assert(deletedSavedRecord?.deletedAt, "Web pull did not receive the iOS delete tombstone.");

    const iosRestorePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            savedItem: {
              id: canonicalSavedRecordID,
              userID,
              codeVersion: defaultSyncCodeVersion,
              sectionID: 113,
              updatedAt: "2026-06-04T04:00:00Z"
            }
          }]
        }
      }
    });
    assert(iosRestorePush.response.ok, "iOS restore push failed.");
    const webDeletePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            savedItem: {
              id: "web-saved-113",
              userID,
              codeVersion: "nyc-2022",
              sectionID: 113,
              updatedAt: "2026-06-04T05:00:00Z",
              deletedAt: "2026-06-04T05:00:00Z"
            }
          }]
        }
      }
    });
    assert(webDeletePush.response.ok, "Web delete push failed.");
    assert(
      webDeletePush.json.acceptedMutationIDs.includes(canonicalSavedRecordID),
      "Web delete did not target the iOS canonical saved record."
    );
    const iosAfterWebDeletePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const webDeletedSavedRecord = iosAfterWebDeletePull.json.mutations.find((item) =>
      item.savedItem?.id === canonicalSavedRecordID
    )?.savedItem;
    assert(webDeletedSavedRecord?.deletedAt, "iOS pull did not receive the web delete tombstone.");

    const legacyWebAnnotationPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            annotation: {
              id: "web-annotation-legacy-540",
              userID,
              codeVersion: "nyc-2022",
              sectionID: 540,
              blockID: "4-html-1",
              noteBody: "Legacy web note should land on the iOS paragraph.",
              updatedAt: "2026-06-04T03:00:00Z"
            }
          }]
        }
      }
    });
    const canonicalLegacyAnnotationID = `${userID}:note:${defaultSyncCodeVersion}:4:rid-0-0-0-164248`;
    assert(legacyWebAnnotationPush.response.ok, "Legacy web annotation push failed.");
    assert(
      legacyWebAnnotationPush.json.acceptedMutationIDs.includes(canonicalLegacyAnnotationID),
      "Legacy web annotation was not normalized to the iOS section and paragraph IDs."
    );

    const cursorRepairPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sinceEventID: legacyWebAnnotationPush.json.latestEventID
      }
    });
    assert(cursorRepairPull.response.ok, "Cursor repair pull failed.");
    const repairedLegacyAnnotation = cursorRepairPull.json.mutations.find((item) =>
      item.annotation?.id === canonicalLegacyAnnotationID
    )?.annotation;
    assert(
      repairedLegacyAnnotation?.sectionID === 4,
      "Cursor pull did not repair the legacy web section ID."
    );
    assert(repairedLegacyAnnotation?.webSectionID === 540, "Cursor pull did not preserve the legacy web section ID.");
    assert(
      repairedLegacyAnnotation?.blockID === "rid-0-0-0-164248",
      "Cursor pull did not repair the legacy web paragraph block ID."
    );

    const cursorPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sinceEventID: pull.json.latestEventID,
        syncSchemaVersion: 2,
        clientCapabilities: ["saved-work", "projects", "legacy-unknown-record"]
      }
    });
    assert(cursorPull.response.ok, "Event cursor sync pull failed.");
    assert(Number.isInteger(cursorPull.json.latestEventID), "Cursor pull did not return a latest event ID.");
    assert(
      cursorPull.json.syncSchemaVersion === 2 &&
        cursorPull.json.clientSchemaVersion === 2 &&
        cursorPull.json.unknownRecordPolicy === "preserve-and-ignore" &&
        cursorPull.json.conflictPolicies.researchAnswer === "immutable" &&
        cursorPull.json.clientCapabilities.includes("legacy-unknown-record"),
      "Sync compatibility metadata did not preserve an older client's unknown-record declaration."
    );

    const projectMutation = {
      project: {
        id: "project-smoke",
        userID,
        codeVersion: "nyc-2022",
        clientID: "project-client-smoke",
        localFolderID: 42,
        name: "Smoke Project",
        description: "",
        color: "#879a6d",
        colorHex: "#FF6B35",
        tintColor: "#6674c8",
        sortOrder: 0,
        updatedAt: "2026-06-04T00:00:00Z"
      }
    };
    const projectSectionMutation = {
      projectSection: {
        id: "project-section-smoke",
        userID,
        codeVersion: "nyc-2022",
        folderClientID: "project-client-smoke",
        localFolderID: 42,
        sectionID: 900001,
        scope: "manual",
        updatedAt: "2026-06-06T00:00:00Z"
      }
    };
    const projectRecordID = `${userID}:project:${defaultSyncCodeVersion}:project-client-smoke`;
    const projectSectionRecordID = `${userID}:project-section:${defaultSyncCodeVersion}:project-client-smoke:900001:manual`;
    const projectPush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [projectMutation, projectSectionMutation]
        }
      }
    });
    assert(projectPush.response.ok, "Project sync push failed.");
    assert(projectPush.json.acceptedMutationIDs.includes(projectRecordID), "Project mutation was not accepted.");
    assert(projectPush.json.acceptedMutationIDs.includes(projectSectionRecordID), "Project section mutation was not accepted.");
    const projectFoundationState = await request("/projects/foundation/state", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, projectID: "project-client-smoke" }
    });
    assert(
      projectFoundationState.response.ok &&
        projectFoundationState.json.projects.some((project) => project.id === "project-client-smoke") &&
        projectFoundationState.json.links.some((link) =>
          link.projectID === "project-client-smoke" &&
          link.targetKind === "canonicalSection" &&
          link.targetID === "900001" &&
          link.metadata.migratedFrom === "projectSection"
        ) &&
        projectFoundationState.json.migrationCheckpoint.schemaVersion === 1,
      "The unified Project foundation did not preserve the existing Project and section membership identities."
    );
    const linkSavedToProject = await request("/projects/foundation/link", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        targetKind: "savedItem",
        targetID: savedSmokeRecordID
      }
    });
    assert(
      linkSavedToProject.response.status === 201 &&
        linkSavedToProject.json.link.targetID === savedSmokeRecordID &&
        linkSavedToProject.json.activity.action === "item.linked",
      "Linking an existing saved section to a Project failed."
    );
    const unlinkSavedFromProject = await request("/projects/foundation/unlink", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        targetKind: "savedItem",
        targetID: savedSmokeRecordID
      }
    });
    assert(
      unlinkSavedFromProject.response.ok &&
        unlinkSavedFromProject.json.link.deletedAt &&
        unlinkSavedFromProject.json.activity.action === "item.unlinked",
      "Unlinking an item did not create a relationship tombstone and meaningful activity event."
    );
    const emptyNotebookList = await request("/notebook/cards/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, projectID: "project-client-smoke" }
    });
    assert(
      emptyNotebookList.response.ok &&
        emptyNotebookList.json.cards.length === 0 &&
        emptyNotebookList.json.cardTypes.includes("finding"),
      "The Project Notebook did not start with an empty structured card list."
    );
    const notebookDocument = {
      schema: "permitext-notebook-card",
      schemaVersion: 1,
      format: "tiptap-json",
      document: {
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "Verify the filing sequence." }]
        }]
      }
    };
    const createNotebookCard = await request("/notebook/cards/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        expectedVersion: 0,
        cardType: "review-task",
        title: "Filing sequence",
        document: notebookDocument
      }
    });
    assert(
      createNotebookCard.response.status === 201 &&
        createNotebookCard.json.card.version === 1 &&
        createNotebookCard.json.card.plainText === "Verify the filing sequence." &&
        createNotebookCard.json.activity.action === "notebook-card.created",
      "Creating a structured Project Notebook card failed."
    );
    const notebookCardID = createNotebookCard.json.card.id;
    const getNotebookCard = await request("/notebook/cards/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        cardID: notebookCardID
      }
    });
    assert(
      getNotebookCard.response.ok &&
        getNotebookCard.json.card.projectIDs.includes("project-client-smoke") &&
        getNotebookCard.json.card.renderedHTML.includes("Verify the filing sequence."),
      "The Notebook card was not returned with static read-only content and Project membership."
    );
    const staleNotebookSave = await request("/notebook/cards/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        cardID: notebookCardID,
        expectedVersion: 0,
        cardType: "review-task",
        title: "Stale filing sequence",
        document: notebookDocument
      }
    });
    assert(
      staleNotebookSave.response.status === 409 &&
        staleNotebookSave.json.code === "NOTEBOOK_VERSION_CONFLICT" &&
        staleNotebookSave.json.card.version === 1,
      "The Notebook accepted a stale explicit revision."
    );
    const reviseNotebookCard = await request("/notebook/cards/save", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        cardID: notebookCardID,
        expectedVersion: 1,
        cardType: "decision",
        title: "Filing sequence confirmed",
        document: notebookDocument
      }
    });
    assert(
      reviseNotebookCard.response.ok &&
        reviseNotebookCard.json.card.version === 2 &&
        reviseNotebookCard.json.activity.action === "notebook-card.revision.saved",
      "Saving an explicit Notebook revision failed."
    );
    const deleteNotebookCard = await request("/notebook/cards/delete", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        cardID: notebookCardID,
        expectedVersion: 2
      }
    });
    assert(
      deleteNotebookCard.response.ok &&
        deleteNotebookCard.json.unlinkedProjectCount === 1 &&
        deleteNotebookCard.json.deletedAt,
      "Deleting a Notebook card did not preserve a tombstone and unlink its Project."
    );
    const notebookListAfterDelete = await request("/notebook/cards/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, projectID: "project-client-smoke" }
    });
    assert(
      notebookListAfterDelete.response.ok && notebookListAfterDelete.json.cards.length === 0,
      "A deleted Notebook card remained in the active Project card list."
    );
    const pullAfterFoundationUnlink = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      pullAfterFoundationUnlink.json.mutations.some((mutation) =>
        mutation.savedItem?.id === savedSmokeRecordID && !mutation.savedItem?.deletedAt
      ),
      "Unlinking a saved section from a Project deleted the independently owned saved record."
    );

    const canonicalProjectColorPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const canonicalProjectColor = canonicalProjectColorPull.json.mutations.find((mutation) =>
      mutation.project?.id === projectRecordID
    )?.project;
    assert(canonicalProjectColor?.colorHex === "#FF6B35", "Project colorHex changed during canonicalization.");
    assert(canonicalProjectColor?.color === "#FF6B35", "Legacy web project color did not match colorHex.");
    assert(canonicalProjectColor?.tintColor === "#FF6B35", "Legacy project tintColor did not match colorHex.");

    const archivedAt = "2026-06-06T00:30:00Z";
    const projectArchivePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            project: {
              ...projectMutation.project,
              updatedAt: archivedAt,
              archivedAt
            }
          }]
        }
      }
    });
    assert(projectArchivePush.response.ok, "Project archive sync push failed.");
    const projectArchivePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const archivedProject = projectArchivePull.json.mutations.find((mutation) =>
      mutation.project?.id === projectRecordID
    )?.project;
    assert(archivedProject?.archivedAt === archivedAt, "Project archive state did not survive sync.");

    const projectRestorePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            project: {
              ...projectMutation.project,
              updatedAt: "2026-06-06T00:45:00Z",
              archivedAt: null
            }
          }]
        }
      }
    });
    assert(projectRestorePush.response.ok, "Project restore sync push failed.");
    const projectRestorePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const restoredProject = projectRestorePull.json.mutations.find((mutation) =>
      mutation.project?.id === projectRecordID
    )?.project;
    assert(restoredProject && restoredProject.archivedAt === null, "Project restore state did not survive sync.");
    const projectActivityAfterRestore = await request("/projects/foundation/state", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID }, projectID: "project-client-smoke" }
    });
    assert(
      projectActivityAfterRestore.response.ok &&
        projectActivityAfterRestore.json.activity.some((event) => event.action === "project.archived") &&
        projectActivityAfterRestore.json.activity.some((event) => event.action === "project.restored"),
      "Project archive and restore did not create meaningful activity-history events."
    );

    const webProjectSectionDeletePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            projectSection: {
              ...projectSectionMutation.projectSection,
              id: "web-project-section-project-client-smoke-900001",
              updatedAt: "2026-06-06T01:00:00Z",
              deletedAt: "2026-06-06T01:00:00Z"
            }
          }]
        }
      }
    });
    assert(webProjectSectionDeletePush.response.ok, "Web project membership delete failed.");
    assert(
      webProjectSectionDeletePush.json.acceptedMutationIDs.includes(projectSectionRecordID),
      "Web project membership delete did not target the native canonical record."
    );
    const iosAfterProjectSectionDeletePull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      iosAfterProjectSectionDeletePull.json.mutations.some((mutation) =>
        mutation.projectSection?.id === projectSectionRecordID && mutation.projectSection?.deletedAt
      ),
      "iOS pull did not receive the web project membership tombstone."
    );
    const iosProjectSectionRestorePush = await request("/sync/push", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            projectSection: {
              ...projectSectionMutation.projectSection,
              id: projectSectionRecordID,
              updatedAt: "2026-06-06T02:00:00Z"
            }
          }]
        }
      }
    });
    assert(iosProjectSectionRestorePush.response.ok, "iOS project membership restore failed.");

    const tagMutation = {
      annotation: {
        id: "tags-smoke",
        userID,
        codeVersion: "nyc-2022",
        sectionID: 900001,
        noteBody: null,
        tags: ["Concrete", "Permit"],
        updatedAt: "2026-06-07T00:00:00Z",
        deletedAt: null
      }
    };
    const tagRecordID = `${userID}:tags:${defaultSyncCodeVersion}:900001`;
    const continuityMutation = {
      continuity: {
        userID,
        codeVersion: "nyc-2022",
        values: {
          selectedCodeSectionID: "building",
          selectedVersionID: "nyc-2022",
          activeProjectID: "42"
        },
        updatedAt: "2026-06-08T00:00:00Z"
      }
    };
    const fullStatePush = await request("/sync/push", {
      method: "POST",
      token: profileAfterAttach.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: {
            id: userID,
            publicUsername: "smoke-pro",
            displayName: "Smoke Pro"
          },
          mutations: [tagMutation, continuityMutation]
        }
      }
    });
    assert(fullStatePush.response.ok, "Full restore-state push failed.");
    assert(fullStatePush.json.acceptedMutationIDs.includes(tagRecordID), "Tag mutation was not accepted.");
    assert(
      fullStatePush.json.acceptedMutationIDs.includes(`${userID}:continuity:${defaultSyncCodeVersion}`),
      "Continuity mutation was not accepted."
    );

    const projectDependencyPull = await request("/sync/pull", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        since: "2026-06-05T00:00:00Z"
      }
    });
    assert(projectDependencyPull.response.ok, "Project dependency pull failed.");
    const pulledKinds = projectDependencyPull.json.mutations.map(mutationKind);
    assert(pulledKinds.includes("projectSection"), "Pull did not include the newer project section.");
    assert(pulledKinds.includes("project"), "Pull did not include the parent project dependency.");

    const reinstallSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-user",
          displayName: "Smoke User Reinstalled"
        }
      }
    });
    assert(reinstallSignIn.response.ok, "Reinstall sign-in failed.");
    assert(
      reinstallSignIn.json.account.publicUsername === "smoke-pro",
      "Reinstall sign-in did not restore the profile."
    );
    assert(
      reinstallSignIn.json.entitlement?.plan === "pro",
      "Reinstall sign-in did not restore the Pro entitlement."
    );

    const reinstallPull = await request("/sync/pull", {
      method: "POST",
      token: reinstallSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(reinstallPull.response.ok, "Reinstall pull failed.");
    const reinstallRecords = reinstallPull.json.mutations.map((mutation) => ({
      kind: mutationKind(mutation),
      record: mutationRecord(mutation)
    }));
    assert(
      reinstallRecords.some((item) => item.kind === "savedItem" && item.record.sectionID === 900001),
      "Reinstall pull did not restore the saved section."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "annotation" && item.record.tags?.includes("Concrete")),
      "Reinstall pull did not restore tags."
    );
    assert(
      reinstallRecords.some((item) =>
        item.kind === "project" &&
        item.record.clientID === "project-client-smoke" &&
        item.record.name === "Smoke Project"
      ),
      "Reinstall pull did not restore the project name."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "projectSection" && item.record.folderClientID === "project-client-smoke"),
      "Reinstall pull did not restore the project membership."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "workboard" && item.record.projectID === "project-client-smoke"),
      "Reinstall pull did not restore the Workboard."
    );
    assert(
      reinstallRecords.some((item) => item.kind === "continuity" && item.record.values.activeProjectID === "42"),
      "Reinstall pull did not restore continuity."
    );

    const unauthorizedChecklist = await request("/admin/accounts/restore-checklist", {
      method: "POST",
      body: { userID }
    });
    assert(unauthorizedChecklist.response.status === 401, "Restore checklist allowed an unauthenticated request.");

    const restoreChecklist = await request("/admin/accounts/restore-checklist", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(restoreChecklist.response.ok, "Restore checklist failed.");
    assert(restoreChecklist.json.hasAccount === true, "Restore checklist did not report the account.");
    assert(restoreChecklist.json.publicUsername === "smoke-pro", "Restore checklist did not report the profile.");
    assert(restoreChecklist.json.entitlement?.plan === "pro", "Restore checklist did not report the entitlement.");
    assert(restoreChecklist.json.hasSession === true, "Restore checklist did not report the session.");
    assert(restoreChecklist.json.passkeyCredentialCount === 0, "Restore checklist reported an active passkey credential.");
    assert(restoreChecklist.json.mutationCounts.savedItem === 4, "Restore checklist did not count saved items and delete tombstones.");
    assert(restoreChecklist.json.mutationCounts.annotation === 3, "Restore checklist did not count annotations.");
    assert(restoreChecklist.json.mutationCounts.project === 3, "Restore checklist did not count projects.");
    assert(restoreChecklist.json.mutationCounts.projectSection === 1, "Restore checklist did not count project memberships.");
    assert(restoreChecklist.json.mutationCounts.workboard === 1, "Restore checklist did not count Workboards.");
    assert(restoreChecklist.json.mutationCounts.continuity === 1, "Restore checklist did not count continuity.");

    const unauthorizedExport = await request("/admin/accounts/export", {
      method: "POST",
      body: { userID }
    });
    assert(unauthorizedExport.response.status === 401, "Account export allowed an unauthenticated request.");

    const accountExport = await request("/admin/accounts/export", {
      method: "POST",
      token: adminToken,
      body: { userID }
    });
    assert(accountExport.response.ok, "Account export failed.");
    assert(accountExport.json.account.appUserID === userID, "Account export did not include the account.");
    assert(accountExport.json.entitlement?.plan === "pro", "Account export did not include the entitlement.");
    assert(accountExport.json.hasSession === true, "Account export did not include session status.");
    assert(accountExport.json.passkeyCredentialIDs.length === 0, "Account export reported an active passkey credential.");
    assert(
      accountExport.json.mutations.some((item) => item.annotation?.tags?.includes("Concrete")),
      "Account export did not include tag mutations."
    );
    assert(
      accountExport.json.mutations.some((item) => item.project?.clientID === "project-client-smoke"),
      "Account export did not include project mutations."
    );

    const revoke = await request("/admin/lifetime-grants/revoke", {
      method: "POST",
      token: grantAdminToken,
      body: { userID }
    });
    assert(revoke.response.ok, "Lifetime revoke failed.");
    assert(revoke.json.entitlement === null, "Lifetime revoke did not clear the entitlement.");

    const signOut = await request("/account/sign-out", {
      method: "POST",
      token: reinstallSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(signOut.response.ok && signOut.json.signedOut === true, "Account sign-out failed.");
    const pullAfterSignOut = await request("/sync/pull", {
      method: "POST",
      token: reinstallSignIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(pullAfterSignOut.response.status === 401, "A revoked session remained usable.");

    const oversizedBody = await request("/account/profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.20"
      },
      rawBody: JSON.stringify({ padding: "x".repeat(1024 * 1024) })
    });
    assert(oversizedBody.response.status === 413, "Oversized request body was not rejected.");

    let rateLimitedResponse = null;
    for (let attempt = 0; attempt < 31; attempt += 1) {
      const result = await request("/account/sign-in", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.30" },
        body: {
          credential: {
            provider: "apple",
            providerUserID: `rate-limit-${attempt}`,
            signedInAt: new Date().toISOString()
          }
        }
      });
      if (attempt < 30) {
        assert(result.response.status !== 429, `Rate limiter rejected allowed request ${attempt + 1}.`);
      } else {
        rateLimitedResponse = result.response;
      }
    }
    assert(rateLimitedResponse?.status === 429, "Sign-in burst was not rate limited.");
    assert(rateLimitedResponse.headers.get("retry-after"), "Rate-limited response omitted Retry-After.");
  } finally {
    server.kill();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().then(
  () => {
    console.log("permitext-sync smoke passed");
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  }
);
