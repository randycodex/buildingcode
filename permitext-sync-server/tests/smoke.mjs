import { spawn } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
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
const existingBuildingSyncCodeVersion =
  "CodeContent/authored/new-york-city/2026-existing-building-code/bundle.json#1";
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

async function requestNDJSON(path, { body, token, signal } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body),
    signal
  });
  const text = await response.text();
  const events = text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const result = events.find((event) => event.type === "result")?.payload || null;
  return { response, events, json: result, text };
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
  await Promise.all([
    ["evidence-retrieval-cases.json", new URL("../evals/evidence-retrieval-cases.json", import.meta.url)],
    ["zoning-cases.json", new URL("../evals/zoning-cases.json", import.meta.url)]
  ].map(async ([name, source]) => {
    await writeFile(join(evaluationRoot, name), await readFile(source, "utf8"));
  }));
  await writeFile(
    join(evaluationRoot, "reviews.json"),
    `${JSON.stringify({ schemaVersion: 1, reviews: [] }, null, 2)}\n`
  );
  await writeFile(
    join(evaluationResultsPath, "smoke-run.json"),
    `${JSON.stringify(evaluationRun, null, 2)}\n`
  );
  const workboardSource = await readFile(new URL("../src/workboard.jsx", import.meta.url), "utf8");
  const notebookEditorSource = await readFile(new URL("../src/notebook-editor.js", import.meta.url), "utf8");
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
  const iosBrowseSource = await readFile(
    new URL("../../NYC CC APP/permitext/Views/BrowseView.swift", import.meta.url),
    "utf8"
  );
  const iosBrowserContextSource = await readFile(
    new URL("../../NYC CC APP/permitext/Models/BrowserContext.swift", import.meta.url),
    "utf8"
  );
  const iosAppSource = await readFile(
    new URL("../../NYC CC APP/permitext/PermitextApp.swift", import.meta.url),
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
  const iosPrivacyManifestSource = await readFile(
    new URL("../../NYC CC APP/permitext/PrivacyInfo.xcprivacy", import.meta.url),
    "utf8"
  );
  const iosInfoPlistSource = await readFile(
    new URL("../../NYC CC APP/permitext/Info.plist", import.meta.url),
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
  const localResearchStartSource = await readFile(
    new URL("../scripts/start-local-research.zsh", import.meta.url),
    "utf8"
  );
  assert(
    serverSource.includes('process.env.NODE_ENV === "test"') &&
      serverSource.includes('process.env.PERMITEXT_TEST_RESEARCH_MOCK === "1"') &&
      !serverSource.includes('process.env.PERMITEXT_RESEARCH_MOCK === "1"'),
    "Research mock mode was not restricted to explicit automated-test execution."
  );
  assert(
    localResearchStartSource.includes('security find-generic-password') &&
      localResearchStartSource.includes('gpt-5.6-terra') &&
      localResearchStartSource.includes('unset PERMITEXT_TEST_RESEARCH_MOCK'),
    "The Keychain-backed localhost Research launcher can enable mock answers."
  );
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VERCEL: "",
      VERCEL_ENV: "",
      PERMITEXT_TRUST_PROXY: "1",
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
      NODE_ENV: "test",
      PERMITEXT_TEST_RESEARCH_MOCK: "1",
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
    const boxedChevronSVGs = Array.from(webRoot.text.matchAll(
      /<svg[^>]*class="[^"]*(?:reader-typography-(?:expand|collapse)-icon|code-filter-chevron-(?:down|up))[^"]*"[^>]*>([\s\S]*?)<\/svg>/g
    )).filter((match) => match[1].includes("<rect"));
    assert(webRoot.response.headers.get("content-type")?.includes("text/html"), "Web root did not return HTML.");
    assert(webRoot.response.headers.get("x-content-type-options") === "nosniff", "Web root omitted security headers.");
    assert(webRoot.response.headers.get("content-security-policy")?.includes("script-src"), "Web root omitted its CSP.");
    assert(
      iosPrivacyManifestSource.includes("<key>NSPrivacyTracking</key>") &&
        iosPrivacyManifestSource.includes("<key>NSPrivacyAccessedAPITypes</key>") &&
        iosPrivacyManifestSource.includes("<string>CA92.1</string>") &&
        iosPrivacyManifestSource.includes("<string>NSPrivacyCollectedDataTypeUserID</string>"),
      "The iOS privacy manifest no longer declares tracking state and required-reason API use."
    );
    assert(
      iosInfoPlistSource.includes("<key>ITSAppUsesNonExemptEncryption</key>") &&
        iosInfoPlistSource.includes("<false/>"),
      "The iOS export-compliance declaration is missing."
    );
    const privacyPolicy = await request("/privacy");
    assert(privacyPolicy.response.ok, "Privacy policy did not load.");
    assert(
      privacyPolicy.response.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"),
      "Privacy policy omitted the HTML security policy."
    );
    assert(
        privacyPolicy.text.includes("Higinio Jimenez Manzano") &&
        privacyPolicy.text.includes("permitext@gmail.com") &&
        !privacyPolicy.text.includes("Return to Permitext") &&
        !privacyPolicy.text.includes('class="back-link"') &&
        webRoot.text.includes('href="/privacy"') &&
        webRoot.text.includes('href="/privacy" target="_blank" rel="noopener noreferrer"') &&
        iosSettingsSource.includes("https://permitext.com/privacy"),
      "The privacy policy or its web/iOS links no longer identify the operator and contact."
    );
    assert(!webRoot.text.includes("reader-share"), "Web reader unexpectedly included its retired section share control.");
    assert(webRoot.text.includes('id="toggle-analysis"'), "Web workspace omitted the global Research chat button.");
    assert(!webRoot.text.includes('id="workboard-dock"'), "Web workspace still included the retired fixed Workboard dock.");
    assert(
      webRoot.text.includes("20260725-visual-inventory-v13"),
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
      'class="topbar-actions"',
      'id="toggle-saved"',
      'id="add-reader"',
      'id="toggle-search"',
      'id="toggle-analysis"',
      'class="topbar-workspaces"',
      'class="topbar-layout-actions"',
      'id="fit-columns"',
      'id="collapse-readers"',
      'id="toggle-settings"',
      'class="topbar-brand"'
    ].map((marker) => topbarSource.indexOf(marker));
    assert(
      topbarGroupOrder.every((index, position) => index >= 0 && (position === 0 || index > topbarGroupOrder[position - 1])),
      "Web topbar tools or right-side workspace controls are no longer in their intended order."
    );
    assert(
      topbarSource.includes('id="toggle-saved" type="button" aria-label="Projects" title="Projects" aria-pressed="false" data-mobile-label="Projects">'),
      "The Projects toolbar control no longer exposes its visible and accessible label."
    );
    const settingsTemplateSource = webRoot.text.slice(
      webRoot.text.indexOf('<template id="settings-template"'),
      webRoot.text.indexOf('<script src="/web/app.js')
    );
    const settingsSectionOrder = [
      '>Plan</h3>',
      '>Account</h3>',
      '>Firm &amp; Collaboration</h3>',
      '>Offline Access</h3>',
      '>Data &amp; Storage</h3>'
    ].map((marker) => settingsTemplateSource.indexOf(marker));
    assert(
      settingsSectionOrder.every((index, position) => index >= 0 && (position === 0 || index > settingsSectionOrder[position - 1])),
      "Web Settings groups do not match the iOS Settings order."
    );
    assert(
      settingsTemplateSource.includes('class="icon-button utility-close settings-close-button"'),
      "Settings should use the same close-column control as the other workspace columns."
    );
    assert(
      !settingsTemplateSource.includes("Destructive Actions") &&
        !settingsTemplateSource.includes("Changes apply to the current code data and synced devices."),
      "Web Settings restored the redundant destructive-actions heading or helper copy."
    );
    assert(
      !settingsTemplateSource.includes('>Reader Font</span>') &&
        !settingsTemplateSource.includes('data-reader-font-family=') &&
        !settingsTemplateSource.includes('class="reader-preview-card settings-card"'),
      "Web Settings should use the fixed published-source typeface without restoring a competing font picker."
    );
    assert(
      !settingsTemplateSource.includes("Public username") &&
        !settingsTemplateSource.includes("account-profile-editor") &&
        !settingsTemplateSource.includes("account-profile-save") &&
        !settingsTemplateSource.includes("account-summary") &&
        !settingsTemplateSource.includes("All browser changes are synced."),
      "Web Settings exposed reserved profile controls or redundant account and sync copy."
    );
    ["Clear All Projects", "Clear Recent Searches", "Clear All Bookmarks", "Clear All Notes", "Clear All Tags"].forEach((label) => {
      assert(settingsTemplateSource.includes(label), `Web Settings omitted ${label}.`);
    });
    assert(
      settingsTemplateSource.includes('class="settings-scroll"') &&
      settingsTemplateSource.includes('class="settings-project-list"') &&
        settingsTemplateSource.includes('class="settings-link-button settings-project-select-all"') &&
        settingsTemplateSource.includes('class="settings-secondary-button settings-project-delete"') &&
        settingsTemplateSource.includes('class="settings-danger-button settings-project-clear-all"'),
      "Web Settings omitted project selection or bulk deletion controls."
    );
    assert(
      settingsTemplateSource.includes('data-plan-option="free"') &&
        settingsTemplateSource.includes('data-plan-option="pro"') &&
        !settingsTemplateSource.includes('data-plan-option="research"') &&
        !settingsTemplateSource.includes("Upgrade option") &&
        settingsTemplateSource.includes("Optional Research add-on:") &&
        !iosSettingsSource.includes('planFeatureRow("Research Add-On"') &&
        iosSettingsSource.includes("Optional Research add-on:") &&
        !settingsTemplateSource.includes('class="settings-billing-line"'),
      "Settings lost the consolidated Pro and optional Research description or restored a separate Research row."
    );
    assert(
      !settingsTemplateSource.includes('>Code Preferences</h3>') &&
        !settingsTemplateSource.includes('settings-jurisdiction-select') &&
        !settingsTemplateSource.includes('settings-version-select') &&
        !iosSettingsSource.includes('Text("NYC Zoning Resolution")') &&
        !iosSettingsSource.includes('localizedCaseInsensitiveContains("zoning")'),
      "Settings should omit jurisdiction and version pickers; code selection belongs in the Reader."
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
    assert(!settingsTemplateSource.includes('class="preview-font-family-select"'));
    assert(
      webRoot.text.includes('class="reader-spacing-controls"') &&
        webRoot.text.includes('class="reader-typography-toggle"') &&
        webRoot.text.includes('class="reader-typography-tools" hidden') &&
        webRoot.text.includes('aria-label="Decrease Reader line spacing"') &&
        webRoot.text.includes('aria-label="Increase Reader line spacing"') &&
        boxedChevronSVGs.length === 0,
      "Reader headers omitted their line-spacing controls or restored boxed chevrons."
    );
    assert(
      webRoot.text.includes('class="reader-internal-search search-box"') &&
        webRoot.text.includes('class="reader-internal-search-input search-input"') &&
        webRoot.text.includes('class="reader-internal-search-clear search-clear-button"'),
      "Reader search no longer shares the Search column field treatment."
    );
    assert(
      webRoot.text.includes('class="reader-trust" hidden') &&
        webRoot.text.includes('class="reader-code-heading"') &&
        webRoot.text.includes('aria-label="Code authority and source"') &&
        webRoot.text.includes('class="reader-trust-state"') &&
        webRoot.text.includes('class="reader-trust-status"') &&
        webRoot.text.includes('class="reader-trust-boundary"') &&
        webRoot.text.includes('class="reader-trust-source"') &&
        webRoot.text.includes("reader-reference-source"),
      "Reader chrome no longer exposes legal-source status or a return-to-source control."
    );

    const workspaceScript = await request("/web/app.js");
    const workspaceStyles = await request("/web/styles.css");
    const interFont = await requestBinary("/web/fonts/inter-latin-wght-normal.woff2?v=20260808-typography-v1");
    const sourceSerifFont = await requestBinary("/web/fonts/source-serif-4-latin-wght-normal.woff2?v=20260808-typography-v1");
    const workspaceStateScript = await request("/web/workspace-state.js");
    const workspaceStartupSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("async function start()"),
      workspaceScript.text.indexOf("start().catch")
    );
    assert(workspaceStyles.response.ok, "Web workspace stylesheet did not load.");
    assert(
      interFont.response.ok && sourceSerifFont.response.ok &&
        interFont.body.length > 40_000 && sourceSerifFont.body.length > 40_000 &&
        interFont.response.headers.get("content-type")?.includes("font/woff2") &&
        sourceSerifFont.response.headers.get("content-type")?.includes("font/woff2") &&
        interFont.response.headers.get("cache-control")?.includes("immutable") &&
        sourceSerifFont.response.headers.get("cache-control")?.includes("immutable"),
      "Self-hosted Permitext typography assets were missing, empty, or not immutable."
    );
    assert(
      workspaceStyles.text.includes('font-family: "Inter Variable";') &&
        workspaceStyles.text.includes('font-family: "Source Serif 4 Variable";') &&
        workspaceStyles.text.includes('--ui-font-family: "Inter Variable"') &&
        workspaceStyles.text.includes('--source-font-family: "Source Serif 4 Variable"') &&
        workspaceStyles.text.includes('--reader-font-size: 16.5px;') &&
        workspaceStyles.text.includes('--reader-line-height: 1.6;') &&
        workspaceStyles.text.includes('.chapter-section h3 {') &&
        workspaceStyles.text.includes('.section-block {') &&
        workspaceStyles.text.match(/\.code-table \{[\s\S]*?font-family: var\(--reader-font-family\);/) &&
        workspaceStyles.text.includes('font-family: var(--ui-font-family);') &&
        workspaceScript.text.includes('fontFamily: "source-serif-4"') &&
        !workspaceScript.text.includes('data-reader-font-family'),
      "The two-font Permitext typography contract is incomplete."
    );
    assert(workspaceStateScript.response.ok, "Named workspace state module did not load.");
    assert(
      webRoot.text.includes('id="workspace-tabs"') &&
        webRoot.text.includes('id="add-workspace"') &&
        webRoot.text.includes('id="workspace-actions"') &&
        webRoot.text.includes('id="collapse-readers" type="button" aria-label="Close all columns" title="Close all columns">Close all</button>') &&
        !webRoot.text.includes(">One Reader</button>") &&
        workspaceScript.text.includes('const workspaceRegistryKey = "permitext:webWorkspaces:v2"') &&
        workspaceScript.text.includes('const toolbarOrderKey = "permitext:webToolbarOrder:v1"') &&
        workspaceScript.text.match(/const defaultToolbarButtonIDs = Object\.freeze\(\[[\s\S]*?"toggle-analysis"[\s\S]*?\]\);/) &&
        !workspaceScript.text.match(/const defaultToolbarButtonIDs = Object\.freeze\(\[[\s\S]*?"fit-columns"[\s\S]*?\]\);/) &&
        workspaceScript.text.includes("function bindToolbarReordering()") &&
        workspaceScript.text.includes('event.dataTransfer.setData("application/x-permitext-toolbar", button.id)') &&
        workspaceScript.text.includes("localStorage.setItem(toolbarOrderKey") &&
        workspaceScript.text.includes("function renderWorkspaceTabs()") &&
        workspaceScript.text.includes("async function switchWorkspace") &&
        workspaceScript.text.includes('function startPaneEdgeResize(event, paneID, edgeSide = "right")') &&
        workspaceScript.text.includes("const edgeAutoResizeThreshold = 32") &&
        workspaceScript.text.includes("const edgeAutoResizeMaxSpeed = 640") &&
        workspaceScript.text.includes("virtualClientX += velocity * elapsed / 1000") &&
        workspaceScript.text.includes("Math.min(trackRect.right, window.innerWidth)") &&
        workspaceScript.text.includes("Math.max(trackRect.left, 0)") &&
        workspaceScript.text.includes('createDivider("", firstPaneID)') &&
        workspaceScript.text.includes('"Resize left edge of first column"') &&
        workspaceScript.text.includes('createDivider(lastPaneID, "")') &&
        workspaceScript.text.includes('"Resize right edge of last column"') &&
        workspaceScript.text.includes("function renderWorkspaceTransitionState") &&
        workspaceScript.text.includes('track.setAttribute("aria-busy", "true")') &&
        workspaceScript.text.includes("await waitForWorkspaceTransitionPaint()") &&
        workspaceScript.text.includes('track.removeAttribute("aria-busy")') &&
        workspaceScript.text.includes("async function closeAllColumns()") &&
        workspaceScript.text.includes("fitColumnsButton.hidden = !hasColumns") &&
        workspaceScript.text.includes("collapseReadersButton.hidden = !hasColumns") &&
        workspaceScript.text.includes("async function openDeepLinkedSectionInReader") &&
        workspaceStyles.text.match(/\.topbar-workspaces\s*\{[^}]*flex:\s*0 1 auto;[^}]*grid-template-columns:\s*minmax\(0, max-content\) auto auto;[^}]*margin-left:\s*auto;/) &&
        workspaceStyles.text.match(/\.workspace-tabs\s*\{[^}]*width:\s*max-content;[^}]*max-width:\s*100%;[^}]*justify-content:\s*flex-end;/) &&
        workspaceStyles.text.includes('.topbar .toolbar-button[draggable="true"]') &&
        workspaceStyles.text.match(/\.workspace-tab\s*\{[^}]*font-size:\s*14px;/) &&
        workspaceStyles.text.match(/\.topbar \.toolbar-button\s*\{[^}]*font-size:\s*14px !important;/) &&
        workspaceStyles.text.match(/\.workspace-tab:focus-visible\s*\{[^}]*outline:\s*0;[^}]*box-shadow:\s*none;/) &&
        workspaceStyles.text.match(/\.topbar \.toolbar-button:focus-visible\s*\{[^}]*outline:\s*0;[^}]*box-shadow:\s*none;/) &&
        workspaceStyles.text.includes(".workspace-empty-state {") &&
        workspaceStyles.text.includes(".pane-edge-resizer {") &&
        workspaceStyles.text.includes(".workspace-switch-placeholder {") &&
        workspaceStateScript.text.includes("export function emptyWorkspaceLayout()") &&
        workspaceStateScript.text.includes("export function duplicateWorkspace"),
      "Blank-start named workspaces, single-row pills, Close All, or direct-link Reader wiring is missing."
    );
    assert(
      workspaceScript.text.includes('panel.querySelector(".settings-close-button")?.addEventListener("click", () => toggleUtilityPane("settings"))'),
      "Settings close-column control is not wired to close the Settings pane."
    );
    assert(
      workspaceScript.text.includes("async function openNewSearchColumn()") &&
        workspaceScript.text.includes('toggleSearchButton.addEventListener("click", () => {\n      void openNewSearchColumn();') &&
        workspaceScript.text.includes('run: () => openNewSearchColumn()') &&
        !workspaceScript.text.match(/async function openNewSearchColumn\(\)[\s\S]*?\.search-input[`"]\)\s*\?\.focus/),
      "Search should create a new Search column from both the toolbar and command palette."
    );
    assert(
      workspaceScript.text.includes("async function toggleProjectsColumns()") &&
        workspaceScript.text.includes('void toggleProjectsColumns();') &&
        workspaceScript.text.includes('void toggleUtilityPane("analysis");') &&
        workspaceScript.text.includes('toggleSettingsButton.addEventListener("click", () => {\n    toggleUtilityPane("settings");'),
      "Projects, Research, and Settings toolbar controls should toggle their columns open and closed."
    );
    const syncStateScript = await request("/web/sync-state.js");
    const evidenceDiscoveryClientSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("function renderEvidenceDiscovery"),
      workspaceScript.text.indexOf("async function renderResearch")
    );
    const researchProjectContextSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("function renderResearchProjectContext"),
      workspaceScript.text.indexOf("async function renderResearchConversation")
    );
    const researchSourceRendererSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("function renderResearchSource"),
      workspaceScript.text.indexOf("function appendHistoricalResearchList")
    );
    const researchConversationRendererSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("async function renderResearchConversation"),
      workspaceScript.text.indexOf("function closeResearchSelectionMenu")
    );
    const projectResearchContextSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("function appendProjectResearchContextEditor"),
      workspaceScript.text.indexOf("function appendProjectResearchHistory")
    );
    const projectContextNoticeSource = workspaceScript.text.slice(
      workspaceScript.text.indexOf("function appendProjectContextNotice"),
      workspaceScript.text.indexOf("async function renderProjectDetail")
    );
    assert(workspaceScript.response.ok, "Web workspace script did not load.");
    assert(
      workspaceScript.text.includes("function bindImmediateUtilityControls()") &&
        workspaceScript.text.includes("function hydrateSavedPanelWhenConnected") &&
        !workspaceScript.text.includes('appendMutedRow(content, "Loading saved content"') &&
        workspaceStartupSource.indexOf("bindImmediateUtilityControls();") >= 0 &&
        workspaceStartupSource.indexOf("bindImmediateUtilityControls();") < workspaceStartupSource.indexOf('api("/code/chapters")'),
      "Search and Saved must bind before cold-start catalogs load, and Saved must hydrate after its shell is mounted."
    );
    assert(
      !workspaceScript.text.includes("Supported by selected evidence") &&
        !workspaceScript.text.includes("Prototype response"),
      "Research answer cards still render the removed status label."
    );
    assert(
      workspaceScript.text.includes('row.classList.toggle("is-active", active)') &&
        workspaceScript.text.includes('checkoutButton.classList.toggle("is-pro-active", pro)') &&
        workspaceScript.text.includes("researchCheckoutButton.hidden = research && !researchAddOn;") &&
        !workspaceScript.text.includes('"Research Included"') &&
        workspaceScript.text.includes('checkoutButton.textContent = pro') &&
        workspaceScript.text.includes('? "Pro Active" : "Manage Subscription"') &&
        workspaceScript.text.includes(': "Upgrade to Pro"'),
      "Web Settings no longer distinguishes active Free and Pro plan actions."
    );
    assert(
      !webRoot.text.includes('id="add-zoning-reader"') &&
        !webRoot.text.includes('>ZR</button>') &&
        workspaceScript.text.includes('const optionsByGroup = new Map();') &&
        workspaceScript.text.includes('group.label = groupLabel;') &&
        workspaceScript.text.includes("codeOptions.forEach((code) => {") &&
        !workspaceScript.text.includes("codeOptions.filter((code) => code.prefix !== zoningCodePrefix)") &&
        workspaceScript.text.includes("const staticSelect = select.disabled;") &&
        !workspaceScript.text.includes("const addZoningReaderButton") &&
        !workspaceScript.text.includes('label: "Open ZR Reader"') &&
        workspaceScript.text.includes('item.classList.toggle("is-indented", indented)') &&
        iosBrowseSource.includes('Section(ReaderCodeMenuSectionTitle.construction2022)') &&
        iosBrowseSource.includes('Section(ReaderCodeMenuSectionTitle.codes2025)') &&
        iosBrowseSource.includes('Section(ReaderCodeMenuSectionTitle.existingAndHistorical)') &&
        iosBrowseSource.includes('codeSectionName: "Zoning Resolution"') &&
        iosBrowserContextSource.includes("storedVersionFileName") &&
        iosBrowserContextSource.includes("persistVersionFileName"),
      "Web Reader pickers should organize all enacted code collections, including Zoning Resolution."
    );
    assert(
      workspaceScript.response.headers.get("content-type")?.includes("javascript"),
      "Web workspace script returned the wrong content type."
    );
    assert(
      workspaceScript.text.includes('{ prefix: "ZR", label: "Zoning Resolution", theme: "zoning", group: "Land Use and Zoning" }') &&
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
        webRoot.text.includes('data-deferred-feature="firm-collaboration" hidden') &&
        !webRoot.text.includes('class="settings-beta-badge"') &&
        workspaceScript.text.includes("firmCollaboration: false") &&
        workspaceScript.text.includes("firmCard.hidden = !releaseSurfaceVisibility.firmCollaboration") &&
        workspaceScript.text.includes("if (releaseSurfaceVisibility.firmCollaboration) {") &&
        workspaceScript.text.includes('postResearch("/organizations/create"') &&
        workspaceScript.text.includes('postResearch("/organizations/members/invite"') &&
        workspaceScript.text.includes('postResearch("/organizations/projects/snapshot"') &&
        workspaceScript.text.includes("function appendProjectEvidenceReviews") &&
        workspaceScript.text.includes("function appendProjectNotes") &&
        workspaceScript.text.includes("function appendProjectCoordinationSummary") &&
        workspaceScript.text.includes("async function renderProjectCoordination(project)") &&
        workspaceScript.text.includes("async function renderProjectCoordinationThread(project, threadID)") &&
        workspaceScript.text.includes("function coordinationActivityActor(event, foundation)") &&
        workspaceScript.text.includes('event.action === "review-thread.status.changed" &&') &&
        workspaceScript.text.includes("event.previousStatus !== event.newStatus") &&
        workspaceScript.text.includes("pendingReportDraftByProject.set(projectDetailKey(identity), thread.targetID)") &&
        workspaceScript.text.includes("reportDraftFocusResultByProject.get(projectDetailKey(identity))") &&
        workspaceScript.text.includes('`[data-evidence-review-id="${CSS.escape(String(thread.targetID))}"]`') &&
        workspaceScript.text.includes("This shared coordination thread preserves the Research item's identity") &&
        workspaceScript.text.includes('postResearch("/projects/collaboration/notes/save"') &&
        workspaceScript.text.includes('postResearch("/projects/collaboration/threads/save"') &&
        workspaceScript.text.includes('postResearch("/projects/collaboration/comments/save"') &&
        workspaceScript.text.includes("function appendProjectReportExports") &&
        workspaceScript.text.includes("if (identity.sharedOnly) row.classList.add(\"is-read-only\")"),
      "Deferred Firm Collaboration should be hidden from Settings while its implementation and shared-record compatibility remain preserved."
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
        !workspaceScript.text.includes("function wireReaderFontFamilyControl"),
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
      !savedTemplateSource.includes('aria-label="Sort saved sections"') &&
        !savedTemplateSource.includes('aria-label="Export saved sections as PDF"') &&
        savedTemplateSource.includes('class="saved-column-scroll"') &&
        savedTemplateSource.includes('class="saved-projects-section code-filter-menu saved-projects-menu"') &&
        savedTemplateSource.includes('class="saved-project-list"') &&
        savedTemplateSource.includes('class="code-filter-menu-toggle saved-projects-menu-toggle"') &&
        !savedTemplateSource.includes('class="saved-project-pages"') &&
        !savedTemplateSource.includes('class="saved-project-page-dots"') &&
        savedTemplateSource.includes('aria-label="Add Project or saved collection"') &&
        savedTemplateSource.includes('class="saved-evidence-search"') &&
        savedTemplateSource.includes('class="saved-evidence-search-input"') &&
        savedTemplateSource.includes('class="saved-evidence-search-close"') &&
        !savedTemplateSource.includes('class="saved-code-filter"') &&
        savedTemplateSource.includes('class="code-filter-menu saved-tag-filter-menu"') &&
        savedTemplateSource.includes('class="saved-tag-filter"') &&
        savedTemplateSource.indexOf('class="saved-projects-section code-filter-menu saved-projects-menu"') < savedTemplateSource.indexOf('class="saved-inline-filters"') &&
        savedTemplateSource.indexOf('class="saved-inline-filters"') < savedTemplateSource.indexOf('class="saved-content"') &&
        !topbarSource.includes('id="toggle-projects"') &&
        !savedTemplateSource.includes('aria-label="Saved text size"') &&
        !projectsTemplateSource.includes('aria-label="Saved text size"'),
      "Saved and Projects no longer follow the combined iOS hierarchy."
    );
    assert(
      workspaceScript.text.includes("function renderSavedProjects(panel, instance, paneID, projects, projectSections)") &&
        workspaceScript.text.includes("function projectForegroundColor(color)") &&
        workspaceScript.text.includes('tile.style.setProperty("--project-on-color", projectForegroundColor(tileColor))') &&
        workspaceScript.text.includes("async function persistProjectOrder(projects, paneID)") &&
        workspaceScript.text.includes("sortOrder: nextProjectSortOrder()") &&
        workspaceScript.text.includes("tile.draggable = true") &&
        workspaceScript.text.includes('tile.addEventListener("dragstart"') &&
        workspaceScript.text.includes('tile.addEventListener("dragover"') &&
        workspaceScript.text.includes('tile.addEventListener("drop"') &&
        workspaceScript.text.includes('tile.addEventListener("dragend"') &&
        workspaceScript.text.includes('event.altKey') &&
        workspaceScript.text.includes('countLabel.className = "saved-project-count"') &&
        workspaceScript.text.includes("countLabel.textContent = String(count)") &&
        workspaceScript.text.includes('tile.dataset.pointerFocus = "true"') &&
        workspaceScript.text.includes("tile.blur()") &&
        workspaceScript.text.includes("delete tile.dataset.pointerFocus") &&
        workspaceScript.text.includes("restoreProjectsStackOrder(options.sourcePaneID)") &&
        workspaceScript.text.includes("const orderedAnchorID = firstDetailIndex > 0 ? ordered[firstDetailIndex - 1] :") &&
        workspaceScript.text.includes('sourcePaneID === "utility:projects" || savedIDs.includes(sourcePaneID)') &&
        workspaceScript.text.includes("tile.append(heading, countLabel)") &&
        workspaceScript.text.includes("selectionActions.append(archiveSelectedButton, deleteSelectedButton)") &&
        workspaceScript.text.includes('editProjectButton.className = "saved-project-tile-edit"') &&
        workspaceScript.text.includes("showProjectCreateSheet(panel, project)") &&
        !workspaceScript.text.includes('typeBadge.className = "saved-folder-type"') &&
        !workspaceScript.text.includes("saved-project-folder-icon") &&
        !workspaceScript.text.includes("projectPages.push(visibleProjects.slice(index, index + 4))") &&
        workspaceScript.text.includes("async function renderSavedFolderContext(panel, savedInstance, paneID, folders)") &&
        workspaceScript.text.includes("instance.selectedFolderID = nextFolderID") &&
        !workspaceScript.text.includes("panes.push(await renderProjects())"),
      "Combined Saved no longer owns the project grid and project-detail flow."
    );
    assert(
      workspaceScript.text.includes("async function activateProjectStudio(project, options = {})") &&
        workspaceScript.text.includes("state.notebooks = keepNotebookOpen ? [identity] : []") &&
        workspaceScript.text.includes("state.workboards = keepGenericWorkboardOpen ? [genericWorkboardIdentity] : []") &&
        workspaceScript.text.includes("state.reportDrafts = keepReportDraftOpen ? [identity] : []") &&
        workspaceScript.text.includes("confirmDiscardIfNeeded()") &&
        workspaceScript.text.includes("Discard unsaved Report changes?") &&
        !workspaceScript.text.includes("This active Project controls every Project-specific workspace.") &&
        !workspaceScript.text.includes('eyebrow.textContent = "Project Studio"') &&
        workspaceScript.text.includes('toggle.className = "project-studio-activity-toggle section-label"') &&
        workspaceScript.text.includes('toggle.setAttribute("aria-expanded", "false")') &&
        workspaceScript.text.includes('wireProjectSectionMotion(section, list, [toggle], options.title || "Recent activity", false)') &&
        workspaceScript.text.includes('title.textContent = "Research history";\n  title.setAttribute("aria-expanded", "false")') &&
        workspaceScript.text.includes('wireProjectSectionMotion(section, body, [title, toggle], "Research history", false)') &&
        workspaceScript.text.includes('coordinationButton.textContent = "Coordination"') &&
        workspaceScript.text.includes('filterBar.setAttribute("role", "tablist")') &&
        workspaceScript.text.includes('resolutionForm.className = "coordination-resolution-form"') &&
        !workspaceScript.text.includes("function appendProjectReviewThreads") &&
        workspaceStyles.text.includes(".project-studio-collapsible-body[hidden]") &&
        workspaceStyles.text.includes("max-height 420ms cubic-bezier(0.22, 1, 0.36, 1)") &&
        workspaceStyles.text.includes(".project-studio-activity li:first-child") &&
        workspaceStyles.text.includes(".project-studio-activity li {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;") &&
        workspaceStyles.text.includes("font-size: 10px !important;\n  text-align: right;\n  white-space: nowrap;") &&
        !workspaceScript.text.includes("No enacted code sections are linked to this Project yet.") &&
        !workspaceScript.text.includes("No standalone Project notes have been recorded yet.") &&
        !workspaceScript.text.includes("No immutable Research answers are linked to this Project yet.") &&
        !workspaceScript.text.includes("No revision or missing-information requests are open.") &&
        workspaceScript.text.includes('headingActions.className = "project-notes-heading-actions"') &&
        workspaceScript.text.includes('wireProjectSectionMotion(section, body, [title, toggle], options.title || "Project information", true)') &&
        workspaceScript.text.includes('ariaLabel: "Project information"') &&
        workspaceScript.text.includes('title: "Project information"') &&
        workspaceScript.text.indexOf("appendProjectNotes(content, identity, foundation);") <
          workspaceScript.text.indexOf("content.append(savedSection);") &&
        !workspaceScript.text.includes('add.textContent = "Add note"') &&
        !workspaceScript.text.includes('title.setAttribute("aria-label", "Project note title")') &&
        !workspaceScript.text.includes("projectCollaborationActor(note)") &&
        workspaceScript.text.includes('panel?.classList.contains("reader-panel")') &&
        workspaceScript.text.includes("getComputedStyle(panel).paddingLeft") &&
        workspaceStyles.text.includes(".project-collaboration-notes-body[hidden]") &&
        !workspaceScript.text.includes("Select saved project items") &&
        !workspaceScript.text.includes("createProjectSectionSelectionController") &&
        workspaceScript.text.includes("function printReportManifestAsPDF(manifest)") &&
        workspaceScript.text.includes("function renderFirmStandardsEditor") &&
        workspaceScript.text.includes('postResearch("/organizations/controls/save"') &&
        workspaceScript.text.includes('postResearch("/reports/options"') &&
        workspaceScript.text.includes('currentOption.textContent = activeDraft.id') &&
        workspaceScript.text.includes(': "Current Report"') &&
        workspaceScript.text.includes('newOption.textContent = "Create new Report…"') &&
        workspaceScript.text.includes('select.className = "report-draft-select"') &&
        workspaceScript.text.includes('titleControl.className = "report-title-control"') &&
        workspaceScript.text.includes('titleButton.className = "report-title-text"') &&
        workspaceScript.text.includes('titleEditor.setAttribute("aria-label", "Edit Report title")') &&
        workspaceScript.text.includes('revisionLabel.textContent = `Revision ${activeDraft.version || 1}`') &&
        workspaceScript.text.includes('select.dataset.customTrigger = "icon-only"') &&
        !workspaceScript.text.includes('titleInput.setAttribute("aria-label", "Report title")') &&
        workspaceScript.text.includes("enhanceSelect(select)") &&
        !workspaceScript.text.includes('templateSelect.className = "report-template-select"') &&
        workspaceScript.text.includes('remove.className = "report-draft-block-remove"') &&
        workspaceScript.text.includes('remove.setAttribute("aria-label", "Remove Report item")') &&
        workspaceScript.text.includes("remove.innerHTML = trashIconSVG()") &&
        workspaceStyles.text.includes(".report-draft-block-actions .report-draft-block-remove") &&
        workspaceStyles.text.includes(".report-draft-select-menu") &&
        workspaceStyles.text.includes(".report-draft-picker .custom-select") &&
        workspaceStyles.text.includes(".report-title-control") &&
        workspaceStyles.text.includes(".report-title-revision") &&
        !workspaceScript.text.includes('dateInput.type = "date"') &&
        !workspaceScript.text.includes('previewMeta.textContent = `${identity.name} · Date and time added automatically on export`') &&
        workspaceScript.text.includes('appendSourceGroup("Project facts", ""') &&
        !workspaceScript.text.includes("Add a paragraph, heading, list, or Project source to begin the professional narrative.") &&
        workspaceScript.text.includes('appendSourceGroup("Saved evidence", ""') &&
        workspaceScript.text.includes('codeGroup.className = `report-evidence-code-group code-theme-${codeTheme(prefix)}`') &&
        workspaceScript.text.includes('codeTitle.textContent = prefix === "Other" ? "Other enacted codes" : codeLabel(prefix)') &&
        workspaceScript.text.includes('const groupKey = `Saved evidence:${prefix}`') &&
        workspaceScript.text.includes('{ numeric: true, sensitivity: "base" }') &&
        workspaceScript.text.includes('`code-theme-${codeTheme(source.codePrefix)}`') &&
        workspaceScript.text.includes('heading.textContent = [source.codePrefix || "Code", sectionNumber]') &&
        workspaceScript.text.includes('block.kind === "evidence" && source') &&
        workspaceScript.text.includes('[source.codePrefix || "Code", source.sectionNumber]') &&
        workspaceScript.text.includes('appendSourceGroup("Research", ""') &&
        workspaceScript.text.includes('appendSourceGroup("Notebook notes", ""') &&
        workspaceScript.text.includes('heading.textContent = `${report.title} · VERSION ${report.reportVersion}`') &&
        workspaceScript.text.includes('`${generatedDate} at ${generatedTime}`') &&
        workspaceScript.text.includes('`${report.itemCount} included ${report.itemCount === 1 ? "item" : "items"}`') &&
        workspaceScript.text.includes('minute: "2-digit"') &&
        !workspaceScript.text.includes('report.presentation?.template?.name,\n        report.author?.displayName') &&
        !workspaceScript.text.includes("Generated reports will appear here as dated, immutable versions.") &&
        workspaceScript.text.includes('dragHandle.className = "report-draft-block-drag-handle"') &&
        workspaceScript.text.includes('wireProjectSectionMotion(section, body, [title, toggle], label, initiallyExpanded') &&
        workspaceScript.text.includes('appendOutputDisclosure(') &&
        !workspaceScript.text.includes('"Permitext Project Report",\n      preview,') &&
        workspaceScript.text.includes('"Report history"') &&
        workspaceStyles.text.includes(".report-source-group-body") &&
        workspaceStyles.text.includes(".report-evidence-code-heading") &&
        workspaceStyles.text.includes(".report-evidence-code-body") &&
        workspaceStyles.text.includes(".report-output-body") &&
        workspaceStyles.text.includes(".report-draft-block.is-drop-before") &&
        workspaceScript.text.includes('source.kind === "researchAnswer"') &&
        workspaceScript.text.includes('source.kind === "notebookCard"') &&
        workspaceScript.text.includes("reportTemplateID: selectedReportTemplateID") &&
        workspaceScript.text.includes("sourceWarnings = sourcePayload.warnings || []") &&
        workspaceScript.text.includes("linked code ${sourceWarnings.length === 1 ? \"source is\" : \"sources are\"} unavailable") &&
        workspaceScript.text.includes("The unavailable source was omitted so you can continue editing this Report.") &&
        workspaceScript.text.includes("function notebookResearchAnswers(foundation)") &&
        workspaceScript.text.includes("notebookResearchAnswers(foundation).forEach((answer) =>") &&
        workspaceScript.text.includes("Array.isArray(document?.document?.content) ? document.document.content : []") &&
        workspaceScript.text.includes('block?.attrs?.src || block?.attrs?.url || ""') &&
        workspaceScript.text.includes("async function downloadProjectReportFile") &&
        workspaceScript.text.includes('fetch("/reports/files/read"') &&
        workspaceScript.text.includes("function refreshOpenProjectPaneTheme(project)") &&
        workspaceScript.text.includes('.forEach((panel) => panel.style.setProperty("--project-color", color))') &&
        workspaceScript.text.includes("function applyProjectDerivedPaneTheme(panel, projectID)") &&
        workspaceScript.text.includes('panel.classList.add("project-derived-panel")') &&
        workspaceScript.text.includes("applyProjectDerivedPaneTheme(panel, preferredResearchProjectID())") &&
        workspaceScript.text.includes("applyProjectDerivedPaneTheme(panel, conversation.primaryProjectID)") &&
        workspaceStyles.text.includes(".analysis-panel.project-derived-panel,\n.research-conversation-panel.project-derived-panel {") &&
        workspaceStyles.text.includes("background: color-mix(in srgb, var(--project-color) 8%, var(--surface-raised));") &&
        workspaceScript.text.includes("refreshOpenProjectPaneTheme(updated)") &&
        workspaceScript.text.includes("function scheduleNotebookAutosave") &&
        workspaceScript.text.includes("flushNotebookAutosave = async () =>") &&
        workspaceScript.text.includes("if (dirty && !(await flushNotebookAutosave())) return;") &&
        !workspaceScript.text.includes("Saved · Version") &&
        !workspaceScript.text.includes("notebookSaveStatus") &&
        workspaceScript.text.includes("async function deleteNotebookCard(card, trigger, options = {})") &&
        !workspaceScript.text.includes('deleteButton.className = "notebook-card-delete"') &&
        workspaceScript.text.includes('deleteSelectedButton.innerHTML = trashIconSVG()') &&
        workspaceScript.text.includes('archiveButton.innerHTML = archiveIconSVG()') &&
        workspaceScript.text.includes('selectButton.innerHTML = selectionModeIconSVG()') &&
        !workspaceScript.text.includes('deleteButton.className = "notebook-danger-action"') &&
        workspaceScript.text.includes('referenceToggle.className = "code-filter-menu-toggle notebook-reference-menu-toggle"') &&
        workspaceScript.text.includes('referenceList.className = "notebook-reference-list"') &&
        workspaceScript.text.includes('option.className = "notebook-reference-option"') &&
        workspaceScript.text.includes('label: "Insert reference"') &&
        workspaceScript.text.includes("async function notebookReferenceCandidates") &&
        workspaceScript.text.includes("function compareNotebookReferences(left, right)") &&
        workspaceScript.text.includes(".sort(compareNotebookReferences)") &&
        workspaceScript.text.includes('filterRail.classList.contains("notebook-reference-list")') &&
        workspaceScript.text.includes("filterGap + notebookReferenceBottomGap") &&
        workspaceScript.text.includes('chapterNumber ? `Chapter ${chapterNumber}` : ""') &&
        workspaceScript.text.includes("function notebookReferenceCodeTitle") &&
        workspaceScript.text.includes('groupTitle.className = `notebook-reference-group-title code-theme-${codeTheme(reference.codePrefix)}`') &&
        workspaceScript.text.includes("const currentProjectSections = (summary.projectSections || [])") &&
        workspaceScript.text.includes("projectSectionBelongsToProject(item, identity)") &&
        workspaceScript.text.includes("displayTitle: citation.title") &&
        workspaceScript.text.includes("optionTitle.textContent = reference.displayTitle") &&
        !workspaceScript.text.includes(': `Code section ${link.targetID}`') &&
        !workspaceScript.text.includes('referenceSelect.setAttribute("aria-label", "Insert reference")') &&
        !workspaceScript.text.includes('addReferenceButton.textContent = "Add link"') &&
        !workspaceScript.text.includes('saveButton.textContent = "Save card"') &&
        !workspaceScript.text.includes('typeSelect.setAttribute("aria-label", "Notebook card type")') &&
        !workspaceScript.text.includes('eyebrow.className = "notebook-eyebrow"') &&
        !workspaceScript.text.includes('title.textContent = "Notebook"') &&
        !workspaceStyles.text.includes(".notebook-eyebrow") &&
        workspaceStyles.text.includes(".notebook-header {\n  display: flex;\n  min-height: var(--panel-title-row-height);\n  align-items: flex-start;\n  justify-content: flex-end;") &&
        workspaceScript.text.includes("cardType: cardAtStart.cardType"),
      "Web Project Studio no longer switches its Project overview, Notebook, Research history, and Report as one guarded workspace."
    );
    assert(
      (
        iosSyncEngineSource.includes("transport.projectHubBootstrap") ||
        iosSyncEngineSource.includes("async let foundation = transport.projectFoundation")
      ) &&
        iosSyncEngineSource.includes("async let notebook = transport.projectNotebookCards") &&
        iosSyncEngineSource.includes("async let reports = transport.projectReportHistory") &&
        iosCodeModelsSource.includes('post("projects/foundation/state"') &&
        iosCodeModelsSource.includes('post("notebook/cards/list"') &&
        iosCodeModelsSource.includes('post("reports/history/list"') &&
        iosCodeModelsSource.includes('post("reports/manifests/get"') &&
        iosCodeModelsSource.includes('appendingPathComponent("reports/files/upload")') &&
        iosSyncEngineSource.includes("func saveProjectReportPDF") &&
        iosLibraryViewModelSource.includes("func projectHubSnapshot(folderID: Int64)") &&
        iosLibraryViewModelSource.includes("func projectReportPDF(manifestID: String)") &&
        iosLibraryViewModelSource.includes("saveProjectReportPDF") &&
        iosLibraryViewModelSource.includes("projectBookmarksByFolderID") &&
        iosLibraryViewModelSource.includes("accountWideProjectBookmarks(") &&
        iosLibraryViewModelSource.includes("repository.evidenceReferences(inFolder: folder.id)") &&
        iosUserDataStoreSource.includes("func evidenceReferences(inFolder folderID: Int64)") &&
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
        !iosBookmarksSource.includes("Flattened Project Workboard preview") &&
        !iosOrganizationProjectHubSource.includes("Workboard preview"),
      "iOS Project Hub must show account-wide Project evidence without exposing the web-only Workboard."
    );
    assert(
      iosLibraryViewModelSource.includes("private var startupWarmupTask: Task<Void, Never>?") &&
        iosLibraryViewModelSource.includes("startupWarmupTask?.cancel()") &&
        iosLibraryViewModelSource.includes("startupFirstUsableDurationMilliseconds") &&
        iosLibraryViewModelSource.includes('name: "firstUsableContent"') &&
        iosLibraryViewModelSource.includes('name: "backgroundWarmup"') &&
        iosSyncEngineSource.includes('category: "Startup"') &&
        Array.from(iosLibraryViewModelSource.matchAll(
          /self\.isInitialContentLoaded = true\s+self\.startupWarmupTask = Task/g
        )).length === 2,
      "iOS startup no longer measures first usable content before cancellable authored or SQLite prewarming."
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
      workspaceScript.text.includes('postJSON("/sync/checkpoint"') &&
        workspaceScript.text.includes("syncCheckpointRequiresFullPull({") &&
        workspaceScript.text.includes("foregroundSyncSchedule.maximumStalenessMs") &&
        workspaceScript.text.includes("claimForegroundSyncLeadership()") &&
        workspaceScript.text.includes('new BroadcastChannel("permitext-sync")') &&
        workspaceScript.text.includes('broadcastForegroundSyncSignal("sync-invalidated"') &&
        workspaceScript.text.includes("function canRunForegroundSync()") &&
        workspaceScript.text.includes('document.visibilityState === "visible"') &&
        workspaceScript.text.includes("navigator.onLine") &&
        workspaceScript.text.includes("async function performForegroundSync(options = {})") &&
        workspaceScript.text.includes("await loadSyncedContent({ force: true, skipOutbox: true })") &&
        workspaceScript.text.includes('window.addEventListener("offline"') &&
        workspaceScript.text.includes("startForegroundSyncLoop({ immediate: true })"),
      "Visible web tabs no longer use adaptive, leader-elected checkpoint synchronization."
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
        syncRepositorySource.includes("lower(plan) = 'pro'") &&
        syncRepositorySource.includes("EXCLUDED.entity_kind = 'project'") &&
        syncRepositorySource.includes("permitext_user_content_records.mutation->'project'->>'folderType' = 'reference'"),
      "Free and Pro capabilities are no longer enforced consistently by the web UI and server."
    );
    assert(
      serverSource.includes(
        "WHERE entity_kind IN ('continuity', 'codeVersionClear', 'workboard')"
      ),
      "PostgreSQL normalized reads no longer preserve Workboard compatibility records."
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
        workspaceScript.text.includes("sessionStorage.getItem(tabWorkspaceKey)") &&
        workspaceScript.text.includes("sessionStorage.setItem(activeWorkspaceSessionKey") &&
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
        iosUserDataStoreSource.includes('"folderClientID": target.folderClientID') &&
        iosUserDataStoreSource.includes('"folderType": target.folderType.rawValue') &&
        iosUserDataStoreSource.includes("let evidenceReferences = try evidenceReferences(inFolder: id)") &&
        iosUserDataStoreSource.includes("for reference in evidenceReferences") &&
        iosUserDataStoreSource.includes("codeVersion: reference.codeVersion") &&
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
      workspaceScript.text.includes("function isFlexibleReaderPaneID(paneID)") &&
        workspaceScript.text.includes("if (isProAccount()) return true;") &&
        workspaceScript.text.includes("(state.readers || []).length === 2") &&
        workspaceScript.text.includes("if (isFlexibleReaderPaneID(paneID)) return false;") &&
        workspaceScript.text.includes("const explicitlyResizedReader = flexibleReader") &&
        workspaceScript.text.includes("value > defaultWidth + 0.5") &&
        workspaceScript.text.includes("if (flexibleReader && !explicitlyResizedReader)") &&
        workspaceScript.text.includes('panel.style.flex = `1 1 ${width}px`') &&
        workspaceScript.text.includes('panel.style.flex = `0 0 ${width}px`'),
      "Pro Readers and Free dual Readers should share the remaining viewport, preserve divider resizing, and stop shrinking at their default minimum width."
    );
    assert(
      workspaceScript.text.includes("function renderReaderTrust") &&
        workspaceScript.text.includes("codeTrustProfiles = libraryPayload.codeTrustProfiles || []") &&
        !workspaceScript.text.includes("function renderReaderSectionToolbar") &&
        workspaceScript.text.includes('leadingActions.className = "reader-notes-leading-actions"') &&
        !workspaceScript.text.includes('reader-notes-project-action') &&
        !workspaceScript.text.includes('reader-notes-link-action') &&
        !workspaceScript.text.includes('bookmarkButton.className = "reader-notes-bookmark"') &&
        workspaceScript.text.includes('researchButton.textContent = "Add to Research"') &&
        workspaceScript.text.includes("leadingActions.append(researchButton)") &&
        workspaceScript.text.includes("selectReaderSectionForResearch(sectionWrapper)") &&
        workspaceScript.text.includes("function readerProjectsForSection") &&
        workspaceScript.text.includes("links.some((link) => projectSectionBelongsToProject(link, project))") &&
        workspaceScript.text.includes('label.textContent = "Saved in"'),
      "Reader trust, note-card actions, or exact Project membership context is no longer wired."
    );
    assert(
      workspaceScript.text.includes("minWidth: defaultPaneWidthForID(pane.dataset.paneId)") &&
        workspaceScript.text.includes("const pushedScrollDelta = appliedPreviousDelta - delta") &&
        workspaceScript.text.includes("startScrollLeft + pushedScrollDelta"),
      "Divider resizing no longer preserves default widths while pushing the workspace under the pointer."
    );
    const resetColumnWidthsStart = workspaceScript.text.indexOf("async function resetVisibleColumnWidths()");
    const resetColumnWidthsEnd = workspaceScript.text.indexOf("\nasync function closeAllColumns()", resetColumnWidthsStart);
    const resetColumnWidthsSource = workspaceScript.text.slice(resetColumnWidthsStart, resetColumnWidthsEnd);
    assert(
      resetColumnWidthsStart >= 0 &&
        resetColumnWidthsEnd > resetColumnWidthsStart &&
        resetColumnWidthsSource.includes("weights[paneID] = defaultPaneWidthForID(paneID)") &&
        resetColumnWidthsSource.includes("const currentLeft = track.scrollLeft") &&
        !resetColumnWidthsSource.includes("state.paneOrder") &&
        !resetColumnWidthsSource.includes("scrollTo({ left: 0"),
      "Reset must restore open column widths without changing their order or returning the workspace to the first column."
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
      workspaceScript.text.includes("const searchResultPageSize = 25;") &&
        workspaceScript.text.includes("function appendSearchLoadMore") &&
        workspaceScript.text.includes("&limit=${searchResultPageSize}&offset=0") &&
        workspaceScript.text.includes("offset=${encodeURIComponent(String(options.nextOffset))}"),
      "Search no longer opens with 25 results and supports explicit pagination."
    );
    assert(
      workspaceScript.text.includes("const readerInitialSectionWindowSize = 5;") &&
        workspaceScript.text.includes("function fetchChapterBodyWindow") &&
        workspaceScript.text.includes("function progressivelyRenderReaderChapter") &&
        workspaceScript.text.includes("new Promise((resolve) => window.setTimeout(resolve, 16))") &&
        workspaceScript.text.includes('console.warn("Reader chapter hydration will retry.", error)') &&
        workspaceScript.text.includes("Math.min(4000, 250 * (2 ** retryCount))") &&
        !workspaceScript.text.includes("The current section is available, but the rest of this chapter could not be loaded.") &&
        workspaceScript.text.includes("status.remove();\n      return;") &&
        workspaceScript.text.includes('content.dataset.chapterFullyLoaded = "true"'),
      "Reader chapters no longer open with a selected-section window before progressive loading."
    );
    const readerContentRendererStart = workspaceScript.text.indexOf("async function renderSectionContent");
    const readerScrollHelperStart = workspaceScript.text.indexOf(
      "function scrollReaderContentToSection",
      readerContentRendererStart
    );
    assert(
      readerContentRendererStart >= 0 &&
        readerScrollHelperStart > readerContentRendererStart &&
        !workspaceScript.text
          .slice(readerContentRendererStart, readerScrollHelperStart)
          .includes("!panel.isConnected"),
      "Reader startup once again rejects its initial detached render panel as stale."
    );
    assert(
      webRoot.text.includes('id="workspace-issue"') &&
        webRoot.text.includes('class="saved-plan-usage"') &&
        webRoot.text.includes('class="settings-plan-usage" role="status" aria-label="Current plan usage" hidden aria-hidden="true"') &&
        workspaceStyles.text.match(/\.settings-plan-usage \{[\s\S]*?background: transparent;/) &&
        workspaceStyles.text.includes(".settings-plan-usage[hidden] {\n  display: none;") &&
        workspaceScript.text.includes("function renderPlanUsageRows") &&
        workspaceScript.text.includes("function refreshVisiblePlanUsage") &&
        workspaceScript.text.includes("scheduleAnnotationPush(record);\n  refreshVisiblePlanUsage();") &&
        workspaceScript.text.includes('card.style.removeProperty("--settings-card-content-height");') &&
        workspaceScript.text.includes("syncAccountState();\n  wireSettingsCardCollapsing(panel);") &&
        workspaceScript.text.includes("function presentWorkspaceIssue"),
      "Hidden plan usage tracking or persistent workspace failure feedback is no longer preserved."
    );
    assert(
      !workspaceScript.text.includes('activeReaderButton') &&
        !workspaceScript.text.includes('Open in reader') &&
        !workspaceScript.text.includes('Open Section ${detail.sectionNumber} in active reader') &&
        !workspaceScript.text.includes('function openSearchResultInReader') &&
        !workspaceScript.text.includes('function openSearchResultInNewReader') &&
        !workspaceScript.text.includes('newReaderButton') &&
        !workspaceScript.text.includes('New reader') &&
        workspaceScript.text.includes('void openSourceInReader(detail, paneIDForUtilityInstance(searchInstance));') &&
        workspaceScript.text.includes("function updateSearchDock") &&
        workspaceScript.text.includes("summary.hidden = !query;") &&
        workspaceScript.text.includes('`Searching in ${scope}`') &&
        workspaceScript.text.includes('`${resultCount.toLocaleString()} ${resultCount === 1 ? "result" : "results"} in ${scope}`'),
      "Search results restored a retired Reader action or omitted their row-level detail action and count."
    );
    assert(
      workspaceScript.text.includes("function renderSearchHistory") &&
        workspaceScript.text.includes("const recentViewLimit = 50;") &&
        workspaceScript.text.includes("const recentSearchLimit = 50;") &&
        workspaceScript.text.includes("function outgoingRecentSearchHistory(existingValues, recentSearches)") &&
        workspaceScript.text.includes("recentSearchHistoryJSON: JSON.stringify(recentSearchHistory)") &&
        workspaceScript.text.includes("state.recentSearchHistory = normalizeRecentSearchHistory([") &&
        workspaceScript.text.includes('label.textContent = "Recently Viewed"') &&
        workspaceScript.text.includes('list.className = "search-history-list search-history-scroll-list search-jump-list"') &&
        workspaceScript.text.includes("async function openRecentlyViewedInReader(searchInstance, entry)") &&
        workspaceScript.text.includes("await openSourceInReader(searchResultDetail(entry), paneIDForUtilityInstance(searchInstance))") &&
        workspaceScript.text.includes('console.warn("Could not open recently viewed section.", error)') &&
        workspaceScript.text.includes('presentWorkspaceIssue(error?.message || "This section could not be loaded. Try opening it again.")') &&
        workspaceScript.text.includes("for (let attempt = 0; attempt < 3 && !section; attempt += 1)") &&
        workspaceScript.text.includes("void openRecentlyViewedInReader(instance, entry)") &&
        workspaceScript.text.includes("await renderSearchHistory(panel, searchInstance, { hydrate: false });") &&
        workspaceScript.text.includes("function hydrateSearchPanelWhenConnected(panel, searchInstance, attempt = 0)") &&
        workspaceScript.text.includes("function mergeRecentlyViewedDetails(entries, options = {})") &&
        workspaceScript.text.includes("function cacheRecentlyViewedReaderPreview(reader, section)") &&
        workspaceScript.text.includes("function updateVisibleSearchHistoryEntry(panel, entry)") &&
        workspaceScript.text.includes("options.onEntry?.(hydratedEntry)") &&
        workspaceScript.text.includes("tile.dataset.recentViewIdentity = recentViewIdentity(entry)") &&
        workspaceScript.text.includes("function recentlyViewedPreviewHasEnactedText(entry)") &&
        workspaceScript.text.includes("if (recentlyViewedPreviewHasEnactedText(entry)) return entry;") &&
        workspaceScript.text.includes("const syncPromise = loadSyncedContent();\n    await renderSearchResults(panel, searchInstance);") &&
        workspaceScript.text.includes("if (attempt < 120)") &&
        workspaceScript.text.includes("requestAnimationFrame(() => hydrateSearchPanelWhenConnected(panel, searchInstance))") &&
        workspaceScript.text.includes("function scheduleWorkspaceStateSaveAfterPaint()") &&
        workspaceScript.text.includes('if (key === "search")') &&
        workspaceScript.text.includes('await transitionWorkspace("utility", { deferStateSave: true });') &&
        workspaceScript.text.includes('behavior: key === "search" ? "auto" : "smooth"') &&
        !workspaceScript.text.includes("void openSavedItemInReader(entry, paneIDForUtilityInstance(instance)") &&
        !workspaceScript.text.includes('bookmarkButton.className = "search-jump-bookmark"') &&
        !workspaceScript.text.includes('pages.className = "search-jump-pages"') &&
        !workspaceScript.text.includes('dots.className = "search-jump-dots"') &&
        workspaceScript.text.includes("const recentSearchPopoverLimit = 15") &&
        workspaceScript.text.includes("function renderSearchRecentPopover(panel, instance)") &&
        workspaceScript.text.includes("normalizeSearchHistory(state.recentSearches, recentSearchPopoverLimit)") &&
        searchTemplateSource.includes('class="search-recent-popover" role="region" aria-label="Recent searches" hidden') &&
        workspaceScript.text.includes('input.addEventListener("focus", openRecentPopover)') &&
        workspaceScript.text.includes('input.addEventListener("click", openRecentPopover)') &&
        workspaceScript.text.includes('event.key === "Escape"') &&
        workspaceScript.text.includes('event.key === "ArrowDown"') &&
        workspaceScript.text.includes("if (jumpSection) results.append(jumpSection)") &&
        !workspaceScript.text.includes('createHistorySection("Recent Searches"') &&
        !workspaceScript.text.includes('"Resize Recently Viewed and Recent Searches"') &&
        workspaceScript.text.includes("function recordRecentSearch") &&
        !workspaceScript.text.includes("function pinSearch") &&
        !workspaceScript.text.includes('"Pin search"') &&
        workspaceScript.text.includes("function removeRecentSearch") &&
        searchTemplateSource.indexOf('class="panel-header"') < searchTemplateSource.indexOf('class="search-box"') &&
        searchTemplateSource.indexOf('class="search-box"') < searchTemplateSource.indexOf('class="search-code-filter"') &&
        searchTemplateSource.indexOf('class="search-code-filter"') < searchTemplateSource.indexOf('class="search-result-summary"') &&
        workspaceScript.text.includes('const options = [{ prefix: "ALL", label: "All Codes" }]') &&
        searchTemplateSource.includes('class="code-filter-menu-label">All Codes</span>') &&
        !searchTemplateSource.includes("All Sections") &&
        !searchTemplateSource.includes("search-all-codes") &&
        !workspaceScript.text.includes("search-all-codes") &&
        searchTemplateSource.indexOf('class="search-result-summary"') < searchTemplateSource.indexOf('class="search-results"'),
      "Search count no longer sits between the code filter list and the first result."
    );
    assert(
      workspaceStyles.text.match(/\.search-jump-tile \{[\s\S]*?height: 112px;[\s\S]*?min-height: 112px;/) &&
        workspaceStyles.text.match(/\.search-jump-preview \{[\s\S]*?max-height: 4\.05em;[\s\S]*?line-height: 1\.35;[\s\S]*?-webkit-line-clamp: 3;/) &&
        workspaceStyles.text.match(/\.search-results\.is-history:not\(\.is-split\) \{[\s\S]*?grid-template-rows: minmax\(0, 1fr\);[\s\S]*?overflow: hidden;/) &&
        workspaceStyles.text.match(/\.search-results\.is-history:not\(\.is-split\) \.search-jump-list \{[\s\S]*?max-height: none;[\s\S]*?overflow-y: auto;/),
      "Recently Viewed previews should reserve three complete lines without clipping the last line."
    );
    assert(
      workspaceStyles.text.match(/\.search-recent-popover \{[\s\S]*?position: absolute;[\s\S]*?opacity: 0;[\s\S]*?transform: translateY\(-6px\) scale\(0\.985\);[\s\S]*?transition: opacity 180ms ease, transform 260ms cubic-bezier\(0\.22, 1, 0\.36, 1\);/) &&
        workspaceStyles.text.match(/\.search-recent-popover\.is-open \{[\s\S]*?opacity: 1;[\s\S]*?pointer-events: auto;[\s\S]*?transform: translateY\(0\) scale\(1\);/),
      "Recent Searches should open as a motion-safe popover from the Search box."
    );
    assert(
      workspaceScript.text.includes("function linkInlineCodeReferences") &&
        workspaceScript.text.includes("function openInlineCodeReference") &&
        workspaceScript.text.includes("function openReferenceInAdjacentReader") &&
        workspaceScript.text.includes("reader.referenceSourceReaderID === sourceReader.id") &&
        workspaceScript.text.includes("referenceSourceReaderID: sourceReader.id") &&
        workspaceScript.text.includes("placePaneAfter(paneIDForReader(sourceReader), paneIDForReader(targetReader))") &&
        workspaceScript.text.includes("inlineCodeReferencePhrases(text)") &&
        workspaceScript.text.includes('./code-references.js?v=20260720-code-reference-links-v18') &&
        workspaceScript.text.includes('./sync-state.js?v=20260811-research-code-basis-v2') &&
        !workspaceScript.text.includes("const savedCount = settingsProjectSections") &&
        !workspaceScript.text.includes('swatch.className = "settings-project-swatch"') &&
        workspaceScript.text.includes("name.textContent = readableProjectName(project)") &&
        workspaceScript.text.includes("function researchSelectionTextFromRange") &&
        workspaceScript.text.includes("function renderResearchProjectContext") &&
        workspaceScript.text.includes("function renderHistoricalResearchRecord") &&
        !researchConversationRendererSource.includes("renderHistoricalResearchControl") &&
        workspaceScript.text.includes('return option.prefix === "AC" ? "Gen Administrative Code" : option.label;') &&
        workspaceScript.text.includes("function wireCodeFilterMenu(filterRail, instance, options = {})") &&
        workspaceScript.text.includes('toggle.setAttribute("aria-expanded", String(open))') &&
        workspaceScript.text.includes('postResearch("/research/conversations/reuse-evidence"') &&
        workspaceScript.text.includes("Project information and additional facts are context only.") &&
        workspaceScript.text.includes('researchSavedItemID: item.savedColumnKind === "bookmark" ? item.id : ""') &&
        workspaceScript.text.includes('data-research-selection-exclude="true"') &&
        !workspaceScript.text.includes('focusedPanel?.querySelector(".utility-close")?.click();') &&
        !workspaceScript.text.includes("Open enacted section") &&
        workspaceScript.text.includes('facts.addEventListener("input"') &&
        workspaceScript.text.includes('facts.addEventListener("blur", saveProjectContextAutomatically)') &&
        !workspaceScript.text.includes("Save Project context") &&
        !workspaceScript.text.slice(
          workspaceScript.text.indexOf("function renderResearchInterpretation"),
          workspaceScript.text.indexOf("async function renderUtilityInstance")
        ).includes('citationsHeading.textContent = "Sources"') &&
        workspaceScript.text.includes('answer.className = "research-answer-primary"') &&
        workspaceScript.text.includes('explanation.className = "research-answer-explanation"') &&
        workspaceScript.text.includes('summary.textContent = "Sources, assumptions, and limits"') &&
        workspaceScript.text.includes('details.open = Boolean(options.detailsOpen)') &&
        workspaceScript.text.includes('renderResearchInterpretation(exactAnswer, answerRecord.answer, { detailsOpen: true })') &&
        workspaceScript.text.includes('`Based on ${enactedCount} enacted ${enactedCount === 1 ? "provision" : "provisions"}`') &&
        workspaceStyles.text.includes(".research-answer-details > summary:focus-visible") &&
        webRoot.text.includes('/web/app.js?v=20260816-optional-evidence-roles-v277'),
      "Reader citations no longer preserve range text or open in an adjacent Reader."
    );
    assert(
      workspaceScript.text.includes("function syncSavedArchiveButtonStates()") &&
        workspaceScript.text.includes('track.querySelectorAll(".saved-projects-archive-button, .projects-archive-button")') &&
        workspaceScript.text.includes('await transitionWorkspace("utility");\n  scrollPaneIntoView("utility:archive");') &&
        !workspaceScript.text.includes('await transitionWorkspace("utility", { refreshPaneIDs: projectOverviewRefreshPaneIDs() });\n  scrollPaneIntoView("utility:archive");'),
      "Opening and closing Archive should preserve the rendered Saved column instead of rebuilding its project and filter cards."
    );
    assert(
      workspaceScript.text.includes("instance.projectsArchiveMode = Boolean(overrides.projectsArchiveMode)") &&
        workspaceScript.text.includes('const projectsMenuLabel = (savedInstance) => {') &&
        workspaceScript.text.includes('return selectedFolder?.name || selectedFolder?.title || "Projects"') &&
        !workspaceScript.text.includes('list.classList.add("is-mode-switching")') &&
        workspaceScript.text.includes("showingArchived = !showingArchived") &&
        workspaceScript.text.includes("archivedProjectRecords(projects)") &&
        !workspaceScript.text.includes('archiveButton.addEventListener("click", toggleArchiveAfterProjectsStack);\n  wireCodeFilterMenu(list, instance') &&
        webRoot.text.indexOf('class="saved-projects-add-button"') <
          webRoot.text.indexOf('class="saved-projects-archive-button"') &&
        webRoot.text.indexOf('class="saved-projects-archive-button"') <
          webRoot.text.indexOf('class="saved-projects-select-button"') &&
        !workspaceStyles.text.includes("saved-project-mode-enter") &&
        workspaceStyles.text.includes("@container (min-width: 580px) {\n  .saved-project-list {\n    grid-template-columns: repeat(3, minmax(0, 1fr));") &&
        workspaceStyles.text.includes('.saved-projects-menu-toggle[aria-expanded="true"]:hover') &&
        workspaceStyles.text.includes(".saved-projects-menu-toggle {\n  flex: 1 1 auto;\n  border-radius: var(--radius-control);") &&
        workspaceStyles.text.includes('.saved-code-filter-menu-toggle[aria-expanded="true"]:hover') &&
        workspaceStyles.text.includes('.saved-tag-filter-menu-toggle[aria-expanded="true"]:hover') &&
        workspaceStyles.text.includes(".saved-projects-add-button[hidden],") &&
        workspaceStyles.text.includes(".saved-projects-archive-button[hidden]") &&
        !workspaceScript.text.includes('selectionCount.className = "saved-projects-bulk-count"') &&
        workspaceStyles.text.includes(".research-conversation-row.is-active {\n  background: transparent;\n  box-shadow: none;") &&
        workspaceStyles.text.includes(".notebook-card-title {\n  display: block;\n  width: 100%;") &&
        workspaceStyles.text.includes(".reader-code-heading {\n  position: relative;\n  z-index: 30;\n  display: flex;") &&
        workspaceStyles.text.includes(".reader-code-heading .reader-code-picker .custom-select,\n.reader-code-heading .reader-code-picker .custom-select-trigger {\n  width: max-content;") &&
        workspaceScript.text.includes('menu.classList.toggle("reader-code-select-menu", readerCodeMenu)') &&
        workspaceScript.text.includes('menu.classList.toggle("reader-chapter-select-menu", readerChapterMenu)') &&
        workspaceScript.text.includes("const menuWidth = readerTopMenu ? boundaryWidth") &&
        workspaceStyles.text.includes(".reader-panel.has-open-reader-menu::after {") &&
        workspaceScript.text.includes("const menuBottomGap = readerChapterMenu ? menuTop : viewportPadding") &&
        workspaceScript.text.includes('selectPanel?.querySelector(".chapter-select + .custom-select .custom-select-trigger")') &&
        workspaceScript.text.includes("const verticalAnchorRect = chapterTrigger?.getBoundingClientRect() || rect") &&
        workspaceScript.text.includes("window.innerHeight - menuTop - menuBottomGap") &&
        workspaceStyles.text.includes(".reader-code-select-menu,\n.reader-chapter-select-menu,\n.report-draft-select-menu {\n  box-sizing: border-box;\n  padding: clamp(14px, 2vw, 20px);\n  border-radius: clamp(22px, 4vw, 30px);") &&
        workspaceStyles.text.includes("--menu-surface: #121213;") &&
        workspaceStyles.text.includes("--menu-subtle-surface: #121213;") &&
        workspaceStyles.text.includes("--saved-projects-card-radius: 12px;") &&
        workspaceStyles.text.includes(".reader-code-select-menu,\n.reader-chapter-select-menu,\n.report-draft-select-menu {") &&
        workspaceStyles.text.includes("background: var(--menu-surface);") &&
        workspaceStyles.text.includes(".reader-code-select-menu .custom-select-group-label {") &&
        workspaceStyles.text.includes(".reader-trust {\n  position: static;") &&
        workspaceStyles.text.includes(".reader-trust-details {\n  position: absolute;") &&
        !workspaceStyles.text.includes(".reader-trust summary::after") &&
        workspaceStyles.text.includes(".reader-panel .panel-header:has(.reader-trust[open]) {\n  z-index: 11;") &&
        workspaceStyles.text.includes("--reader-header-overlay-height: calc(var(--panel-control-row-top) + 40px);") &&
        !workspaceStyles.text.includes(".reader-trust {\n  display: none;") &&
        workspaceScript.text.includes('document.querySelectorAll(".reader-trust[open]")') &&
        workspaceStyles.text.includes("box-shadow: none;") &&
        !workspaceScript.text.includes("function appendProjectStudioOverview") &&
        !workspaceStyles.text.includes(".project-studio-metrics {") &&
        workspaceScript.text.includes('count.className = "project-section-count"') &&
        workspaceScript.text.includes("body.append(projectNoteEditor(identity, primaryNote") &&
        workspaceScript.text.includes('savedTitle.className = "project-section-toggle-label section-label"') &&
        workspaceScript.text.includes('savedToggle.setAttribute("aria-label", "Collapse Saved evidence")') &&
        workspaceScript.text.includes('savedBody.className = "project-studio-collapsible-body project-saved-evidence-body"') &&
        workspaceScript.text.includes('function wireProjectSectionMotion(section, body, controls, label, initialExpanded = false, motionOptions = {})') &&
        workspaceScript.text.includes('section.classList.add("is-restoring", "is-open", "is-settled")') &&
        workspaceScript.text.includes('section.classList.remove("is-settled")') &&
        workspaceScript.text.includes("const settleAfterTransition = () =>") &&
        workspaceScript.text.includes("const bodyResizeObserver = new ResizeObserver") &&
        workspaceScript.text.includes('bodyResizeObserver.observe(body)') &&
        workspaceScript.text.includes('Array.from(body.children).forEach((child) => bodyResizeObserver.observe(child))') &&
        workspaceStyles.text.includes(".project-section-motion.is-open.is-settled > .project-section-motion-body {\n  max-height: none;") &&
        workspaceScript.text.includes('wireProjectSectionMotion(savedSection, savedBody, [savedTitle, savedToggle], "Saved evidence", true)') &&
        workspaceScript.text.includes('headingMeta.append(scope, projectSectionCount(answers.length, "Evidence reviews"))') &&
        workspaceStyles.text.includes(".project-section-count {") &&
        workspaceStyles.text.includes(".notebook-toolbar {\n  display: block;") &&
        workspaceStyles.text.includes(".notebook-reference-menu {\n  display: grid;") &&
        workspaceStyles.text.includes(".notebook-toolbar .notebook-reference-menu-toggle {\n  min-height: 40px;\n  border-radius: var(--radius-pill);\n  background: var(--menu-surface);") &&
        workspaceStyles.text.includes(".notebook-reference-list {\n  display: block;") &&
        workspaceStyles.text.includes("overflow-wrap: anywhere;") &&
        workspaceStyles.text.includes(".notebook-reference-group-title {") &&
        workspaceStyles.text.includes("margin: var(--space-2) 0 0;") &&
        workspaceStyles.text.includes(".notebook-reference-group-title:first-child {") &&
        workspaceStyles.text.includes(".code-filter-menu.is-open .notebook-reference-list {\n  padding-bottom: var(--space-3);") &&
        workspaceStyles.text.includes(".notebook-editor-surface .bn-container {") &&
        workspaceStyles.text.includes(".notebook-editor-surface .bn-editor {") &&
        notebookEditorSource.includes("portalElements: { slashMenu: null },") &&
        workspaceStyles.text.includes(".bn-suggestion-menu {\n  background: var(--menu-surface) !important;") &&
        workspaceStyles.text.includes(".notebook-editor-surface .bn-block-content::after,\n.notebook-editor-surface .bn-side-menu svg {\n  color: var(--text-tertiary) !important;") &&
        workspaceStyles.text.includes('.notebook-editor-surface table :is(th, td) {\n  border-color: #000 !important;') &&
        workspaceStyles.text.includes('[data-line-spacing="24px"] { --notebook-line-spacing: 24px; line-height: 24px !important; }') &&
        workspaceStyles.text.includes('[data-text-size="24px"] { --notebook-text-size: 24px; font-size: 24px !important; }') &&
        workspaceStyles.text.includes("line-height: max(var(--notebook-line-spacing, 0px), calc(var(--notebook-text-size) * 1.2)) !important;") &&
        workspaceStyles.text.includes(".notebook-editor-surface [data-text-size] * {\n  font-size: inherit !important;") &&
        workspaceStyles.text.includes("border: 0;\n  border-radius: var(--radius-control);") &&
        workspaceStyles.text.includes(".notebook-editor-surface .bn-container {\n  min-height: 100%;\n  border-radius: inherit;") &&
        workspaceStyles.text.includes(".notebook-editor-surface,\n  .notebook-editor-surface .bn-container,\n  .notebook-editor-surface .bn-editor {\n    background: var(--menu-surface);\n    color: var(--text-primary);") &&
        workspaceStyles.text.includes("border-color: #fff !important;") &&
        workspaceStyles.text.includes(".notebook-editor-surface:not(.project-note-editor-surface) .bn-editor {\n  padding-inline-start: calc(var(--space-4) + 32px);") &&
        workspaceStyles.text.includes(".project-note-block-editor {\n  position: relative;\n  height: 260px;") &&
        workspaceStyles.text.includes(".project-note-resize-handle {\n  position: absolute;") &&
        workspaceStyles.text.includes("right: 0;\n  bottom: 0;\n  left: 0;") &&
        workspaceScript.text.includes('resizeHandle.className = "project-note-resize-handle"') &&
        workspaceScript.text.includes("resizeHandle.setPointerCapture(event.pointerId)") &&
        workspaceStyles.text.includes("padding-top: calc(var(--project-pane-band-height) - var(--panel-padding) + var(--space-3));") &&
        workspaceStyles.text.includes(".project-detail-header-actions {\n  position: absolute;\n  top: 0;\n  right: 0;") &&
        workspaceStyles.text.includes("  resize: none;\n  border-radius: var(--radius-card);\n  background: transparent;") &&
        workspaceStyles.text.includes(".project-note-editor-surface {") &&
        !workspaceStyles.text.includes(".notebook-tiptap-editor {") &&
        workspaceStyles.text.includes(".notebook-card-footer {\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;") &&
        workspaceStyles.text.includes(".notebook-card-rail-actions {") &&
        workspaceScript.text.includes('rail.className = "notebook-card-rail code-filter-menu notebook-card-menu"') &&
        workspaceScript.text.includes('railLabel.textContent = ""') &&
        workspaceScript.text.includes('label: () => showingArchivedCards ? "Archive" : cardMenuState.cardsMenuOpen ? "" : "Notes"') &&
        workspaceScript.text.includes('railLabel.textContent = showingArchivedCards ? "Archive" : cardMenuState.cardsMenuOpen ? "" : "Notes";') &&
        workspaceScript.text.includes('if (!cardMenuState.cardsMenuOpen && showingArchivedCards)') &&
        workspaceScript.text.includes("cardsMenuOpen: notebookCardMenuOpenByProject.get(projectID) !== false") &&
        workspaceScript.text.includes("wireCodeFilterMenu(cardList, cardMenuState, cardMenuOptions)") &&
        workspaceScript.text.includes('closeButton.className = "icon-button utility-close notebook-close";') &&
        workspaceScript.text.includes('closeButton.setAttribute("aria-label", "Close notebook");') &&
        workspaceScript.text.includes("closeButton.innerHTML = circleXIconSVG();") &&
        workspaceStyles.text.includes(".notebook-header {\n  display: flex;\n  min-height: var(--panel-title-row-height);") &&
        workspaceStyles.text.includes(".notebook-card-rail.is-open {\n  padding-bottom: 0;") &&
        workspaceStyles.text.includes(".notebook-card-menu-toggle {\n  width: 100%;\n  min-height: 40px;\n  background: var(--menu-surface);") &&
        workspaceStyles.text.includes(".notebook-card-list {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  grid-auto-flow: row;") &&
        workspaceStyles.text.includes("padding-inline: var(--space-3);\n  border-radius: var(--radius-control);\n  background-color: var(--menu-surface);") &&
        workspaceStyles.text.includes("background-color: var(--menu-surface);\n  background-image: none;") &&
        workspaceStyles.text.includes(".notebook-card-menu.is-open .notebook-card-list {\n  height: min(var(--notebook-card-list-height, 156px), 70vh);\n  max-height: min(var(--notebook-card-list-height, 156px), 70vh);") &&
        workspaceScript.text.includes('cardListResizeHandle.className = "notebook-card-list-resize-handle"') &&
        workspaceStyles.text.includes(".notebook-card-list-resize-handle::after") &&
        workspaceScript.text.includes("const minimumCardListHeight = 156") &&
        workspaceScript.text.includes("Math.max(minimumCardListHeight, last.bottom - first.top)") &&
        workspaceScript.text.includes("requestAnimationFrame(sizeCardListForThreeRows)") &&
        workspaceStyles.text.includes(".notebook-card-tile {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;") &&
        workspaceStyles.text.includes(".notebook-reference-menu .notebook-reference-list {\n  background-image: none;") &&
        workspaceStyles.text.includes("max-height: min(var(--code-filter-menu-height, 240px), 52vh, 360px);") &&
        workspaceStyles.text.includes("overflow-y: auto;\n  overscroll-behavior-y: contain;\n  scrollbar-gutter: stable;") &&
        workspaceStyles.text.includes("border-radius: 0;\n  background: transparent;") &&
        workspaceScript.text.includes('introductionResizeHandle.className = "report-introduction-resize-handle"') &&
        workspaceScript.text.includes("introductionResizeHandle.setPointerCapture(event.pointerId)") &&
        workspaceStyles.text.includes(".report-introduction-resize-handle::after") &&
        workspaceStyles.text.includes("background: color-mix(in srgb, var(--project-color) 9%, var(--surface-muted));\n  font-size: 12px;") &&
        !workspaceScript.text.includes("notebookCardTypeLabel") &&
        !workspaceScript.text.includes('preview.textContent = card.plainText || "Empty card";') &&
        !workspaceScript.text.includes('list.addEventListener("animationend", finishSwitch, { once: true })') &&
        !workspaceScript.text.includes('const entryOffset = showingArchived ? "6px" : "-6px";') &&
        workspaceScript.text.includes('filterRail.classList.contains("saved-project-list")') &&
        workspaceScript.text.includes("? filterGap * 2") &&
        !workspaceStyles.text.includes(".saved-project-list.is-mode-switching {") &&
        !workspaceStyles.text.includes("@keyframes saved-project-mode-enter {") &&
        !workspaceStyles.text.includes(".saved-project-list.is-switching {") &&
        workspaceStyles.text.includes('.saved-projects-menu-toggle[aria-expanded="true"],\n.saved-projects-menu-toggle[aria-expanded="true"]:hover {\n  background: transparent;') &&
        workspaceStyles.text.includes(".saved-projects-menu.is-open .saved-project-list {\n  padding: var(--space-2);") &&
        workspaceStyles.text.includes("margin: var(--space-3) var(--panel-padding) var(--space-3);") &&
        workspaceStyles.text.includes(".notebook-toolbar .notebook-reference-option {") &&
        workspaceStyles.text.includes(".notebook-reference-list {\n  display: block;") &&
        workspaceStyles.text.includes("border-bottom: 1px solid color-mix(in srgb, var(--text-tertiary) 24%, transparent);") &&
        workspaceStyles.text.includes("-webkit-line-clamp: 2;") &&
        workspaceStyles.text.includes("height: auto;") &&
        workspaceScript.text.includes("option.title = reference.label;") &&
      webRoot.text.includes('/web/styles.css?v=20260816-optional-evidence-roles-v277'),
      "The Saved Projects or Notebook Project notes list no longer preserve their compact menu behavior."
    );
    assert(
      !researchSourceRendererSource.includes('"Selected passage"') &&
        researchSourceRendererSource.includes('label.textContent = "Pinned enacted source"') &&
        researchSourceRendererSource.includes('"Contextual enacted source — does not govern this answer"') &&
        !researchSourceRendererSource.includes(': "Permitext enacted source"') &&
        researchConversationRendererSource.includes('.filter((source) => source.kind === "selection")') &&
        researchConversationRendererSource.includes(
          "const projectContextSection = renderResearchProjectContext(evidenceScroll, conversation);"
        ) &&
        researchConversationRendererSource.includes(
          "projectContextSection.prepend(sources);"
        ) &&
        !researchConversationRendererSource.includes("content.append(sources);"),
      "Selected Research sources should lead the context pane without a redundant card label."
    );
    assert(
      workspaceScript.text.includes("function readerSectionsWithoutRepeatedCatalogAliases") &&
        workspaceScript.text.includes("latestBodyText.includes(catalogTitle)") &&
        workspaceScript.text.includes("sectionWrapper.dataset.sectionAliases") &&
        workspaceScript.text.includes('[data-section-aliases~="${CSS.escape(String(sectionID))}"]'),
      "The Reader should render imported nested-list aliases only once while preserving their jump targets."
    );
    assert(
      workspaceScript.text.includes('prefix: "EBC"') &&
        workspaceScript.text.includes('label: "Existing Building Code (effective July 17, 2027)"') &&
        !workspaceScript.text.includes("Enacted, not yet effective.") &&
        !webRoot.text.includes('class="reader-code-status"'),
      "The Existing Building Code should retain its effective date in the title without an inline status notice."
    );
    assert(
      ["ECC", "EC", "FC", "BC68", "HMC", "T24", "T25", "T26", "T28", "LL"].every((prefix) =>
        workspaceScript.text.includes(`prefix: "${prefix}"`)
      ) &&
        workspaceScript.text.includes('group: "2022 Construction Codes"') &&
        workspaceScript.text.includes('group: "2025 Codes"') &&
        workspaceScript.text.includes('group: "Existing and Historical Building Codes"') &&
        workspaceScript.text.includes('group: "Fire and Housing"') &&
        workspaceScript.text.includes('group: "Administrative Code"') &&
        workspaceScript.text.includes('group: "Local Laws"') &&
        workspaceScript.text.includes('group: "Land Use and Zoning"') &&
        !workspaceScript.text.includes("The adopted 2020 NFPA 70 text is referenced but is not reproduced.") &&
        !workspaceScript.text.includes("Historical enacted text. Applicability depends on the project date") &&
        !workspaceScript.text.includes("Construction-related unconsolidated enactments, including transition"),
      "Every enacted-code expansion library should be organized and available in the Reader."
    );
    assert(
      workspaceScript.text.includes("function closeLinkedReaderForSearch(searchID)") &&
        workspaceScript.text.includes("closeLinkedReaderForSearch(searchID);") &&
        workspaceScript.text.includes("if (instance.key === \"search\") closeLinkedReaderForSearch(instance.id);") &&
        workspaceScript.text.includes("delete state.paneWeights[readerPaneID]") &&
        workspaceScript.text.includes("paneID !== readerPaneID"),
      "Closing a Search section-detail column should also close only its linked Reader."
    );
    assert(
      workspaceScript.text.includes("async function openSavedItemInReader(item, savedPaneID)") &&
        workspaceScript.text.includes("void openSavedItemInReader(openItem, paneID)") &&
        workspaceScript.text.includes("async function openSourceInReader(item, anchorPaneID = \"\", options = {})") &&
        workspaceScript.text.includes("readerMatchesSource(candidate, detail)") &&
        workspaceScript.text.includes("candidate.sourceAnchorPaneID === anchorPaneID") &&
        workspaceScript.text.includes("placePaneAfter(anchorPaneID, paneID)") &&
        workspaceScript.text.includes("revealReaderSourceTarget(reader, navigationItem, options.evidenceAnchor)"),
      "Saved Evidence items should open or reuse an exact-passage Reader beside Saved."
    );
    assert(
      savedTemplateSource.includes('<p class="eyebrow panel-kind">Projects</p>') &&
        savedTemplateSource.includes('<h2 class="panel-title">Projects</h2>') &&
        !savedTemplateSource.includes('<p class="eyebrow panel-kind">Saved</p>'),
      "The Projects column should identify itself as Projects rather than Saved."
    );
    assert(
      workspaceStyles.text.includes(".topbar {\n  display: flex;") &&
        workspaceStyles.text.includes("border-bottom: 1px solid var(--border);\n  text-transform: uppercase;") &&
        workspaceStyles.text.includes(".topbar button,\n.topbar input,\n.topbar .connection-status,\n.topbar .topbar-brand-plan {\n  text-transform: uppercase;") &&
        workspaceStyles.text.includes("letter-spacing: -0.03em;\n  text-transform: none;"),
      "The top bar should be uppercase while preserving the permitext wordmark casing."
    );
    assert(
      workspaceStyles.text.includes(".is-saved-selecting .saved-section-row .saved-row-button {\n  padding-right: 40px;") &&
        !workspaceStyles.text.includes(".is-saved-selecting .saved-section-row.is-selected {\n  background:"),
      "Saved Evidence selection should reserve room for its checkmark without highlighting the selected row."
    );
    assert(
      workspaceScript.text.includes("function researchSourceCitation(source)") &&
        workspaceScript.text.includes("function researchDisplaySources(sources = [])") &&
        workspaceScript.text.includes("sourceText.includes(currentText) || currentText.includes(sourceText)") &&
        workspaceScript.text.includes("displayedSources.forEach((source) => sourceList.append(renderResearchSource(source)))") &&
        workspaceScript.text.includes("sectionGroupLabel") &&
        workspaceScript.text.includes("sectionGroupTitle") &&
        workspaceScript.text.includes(": researchSourceCitation(source)") &&
        workspaceScript.text.includes('code-theme-${codeTheme(source.codePrefix || "BC")}') &&
        workspaceStyles.text.includes(".research-source-toggle > strong {") &&
        workspaceStyles.text.includes("color: var(--code-accent);"),
      "Research selected passages should show hierarchical citations without repeating contained versions of one source."
    );
    assert(
      workspaceStyles.text.includes(".research-source-card + .research-source-card {") &&
        workspaceStyles.text.includes("border-top: 1px solid var(--border);") &&
        workspaceStyles.text.includes("background: transparent;"),
      "Research source passages should remain flat and separated by thin dividers."
    );
    assert(
      workspaceStyles.text.match(/\.research-sources-toggle \{[\s\S]*?justify-content: flex-start;[\s\S]*?width: 100%;[\s\S]*?text-align: left;/),
      "The Research evidence disclosure label should use the available column width without overlapping its sources."
    );
    assert(
      workspaceScript.text.includes('toggle.className = "research-source-toggle"') &&
        workspaceScript.text.includes("setResearchSourceCardExpanded(card, !expanded)") &&
        workspaceScript.text.includes('card.style.setProperty("--research-source-body-height"') &&
        workspaceScript.text.includes('event.propertyName !== "max-height"') &&
        workspaceScript.text.includes('card.classList.add("is-restoring", "is-open")') &&
        workspaceScript.text.includes("const restoreWhenMounted = (remainingFrames = 60)") &&
        workspaceStyles.text.includes("max-height 420ms cubic-bezier(0.22, 1, 0.36, 1)") &&
        workspaceStyles.text.includes("opacity 260ms ease") &&
        workspaceStyles.text.includes(".research-source-card.is-open > .research-source-body") &&
        workspaceStyles.text.includes(".research-source-body[hidden]"),
      "Research passage titles should expand and collapse their passage content."
    );
    assert(
      workspaceScript.text.includes('sourceToggle.className = "research-sources-toggle"') &&
        workspaceScript.text.includes('"Collapse all passages"') &&
        workspaceScript.text.includes('"Expand all passages"') &&
        workspaceScript.text.includes("const anyExpanded = passageToggles.some") &&
        workspaceScript.text.includes("setResearchSourceCardExpanded(card, expandAll)") &&
        workspaceScript.text.includes('class="research-chevron-down"') &&
        workspaceScript.text.includes('class="research-chevron-up"') &&
        !workspaceScript.text.includes('disclosure.textContent = "▾"') &&
        !workspaceScript.text.includes('disclosure.textContent = "▸"') &&
        workspaceStyles.text.includes(".research-sources-toggle {"),
      "Research passages should provide a single chevron to collapse or expand every passage."
    );
    assert(
        workspaceStyles.text.includes(".research-composer {") &&
        workspaceStyles.text.includes(".research-dialogue-pane {") &&
        workspaceStyles.text.includes(".research-message.is-assistant {\n  display: grid;\n  gap: var(--space-3);") &&
        workspaceScript.text.includes("renderResearchFeedback(container, options.message, options.conversationID)") &&
        !workspaceScript.text.includes("renderResearchFeedback(card, options.message, options.conversationID)") &&
        workspaceScript.text.includes('compact.className = "research-feedback-compact"') &&
        workspaceScript.text.includes('details.className = "research-feedback-details"') &&
        workspaceScript.text.includes('reviewRow.className = "research-answer-review-row"') &&
        workspaceScript.text.includes('evidenceReviewedSummary.textContent = "Evidence reviewed"') &&
        workspaceScript.text.includes("reviewRow.append(evidenceReviewed, compact)") &&
        workspaceScript.text.includes("(evidenceReviewedBody || bubble).append(answerSources)") &&
        workspaceScript.text.includes('void saveFeedback("helpful"') &&
        workspaceScript.text.includes('problemButton.setAttribute("aria-expanded", String(open))') &&
        !workspaceScript.text.includes("Was this answer useful?") &&
        workspaceStyles.text.includes(".research-feedback-icon {") &&
        workspaceStyles.text.includes(".research-answer-review-row {") &&
        workspaceStyles.text.includes(".research-feedback-details[hidden] {") &&
        workspaceStyles.text.includes("background: var(--research-conversation-background);"),
      "Research composer should match the conversation background and answer feedback should stay compact until requested."
    );
    assert(
        workspaceScript.text.includes("researchConversationEvidencePane: false") &&
        workspaceScript.text.includes("function bindResearchEvidenceDivider") &&
        workspaceScript.text.includes("researchEvidenceSplitRatios") &&
        workspaceScript.text.includes("delete state.researchEvidenceSplitRatios[conversation.id]") &&
        researchConversationRendererSource.includes('evidencePane.className = "research-evidence-pane"') &&
        researchConversationRendererSource.includes("evidencePane.hidden = !releaseSurfaceVisibility.researchConversationEvidencePane") &&
        researchConversationRendererSource.includes('dialoguePane.className = "research-dialogue-pane"') &&
        researchConversationRendererSource.includes('divider.className = "research-evidence-divider"') &&
        researchConversationRendererSource.includes("divider.hidden = !releaseSurfaceVisibility.researchConversationEvidencePane") &&
        researchConversationRendererSource.includes('divider.setAttribute("aria-orientation", "horizontal")') &&
        !researchConversationRendererSource.includes('evidenceHeading.className = "research-evidence-heading"') &&
        !researchConversationRendererSource.includes('evidenceCollapse.className = "icon-button research-evidence-collapse"') &&
        researchConversationRendererSource.includes('divider.setAttribute("aria-controls", `${evidenceScroll.id} ${thread.id}`)') &&
        researchConversationRendererSource.includes("thread.scrollTop = thread.scrollHeight") &&
        workspaceStyles.text.includes("var(--research-evidence-size, 36%)") &&
        workspaceStyles.text.includes(".research-evidence-divider {") &&
        workspaceStyles.text.includes(".research-evidence-pane {\n  grid-row: 1;") &&
        workspaceStyles.text.includes(".research-evidence-divider {\n  grid-row: 2;") &&
        workspaceStyles.text.includes(".research-dialogue-pane {\n  grid-row: 3;") &&
        workspaceStyles.text.includes(".research-conversation-content.is-evidence-pane-deferred {") &&
        workspaceStyles.text.includes(".research-evidence-pane[hidden] {") &&
        workspaceStyles.text.includes("min-height: 17px;") &&
        workspaceStyles.text.includes("top: 8px;") &&
        workspaceStyles.text.includes("cursor: row-resize;") &&
        workspaceStyles.text.includes(".research-message-thread {\n  display: grid;\n  min-height: 0;"),
      "Deferred Research evidence UI should remain implemented behind the release boundary while the conversation fills the pane."
    );
    assert(
      !workspaceScript.text.includes("Assign this conversation when its research belongs to a specific Project.") &&
        !workspaceScript.text.includes("research-project-context-unassigned") &&
        !workspaceScript.text.includes("From the Project folder") &&
        !workspaceScript.text.includes("research-project-information") &&
        !workspaceScript.text.includes("Question captured for this Code Decision") &&
        !workspaceScript.text.includes("research-message is-user is-starter") &&
        workspaceScript.text.includes('const starterAnalysisQuestion = conversation.messages.length === 0') &&
        workspaceScript.text.includes('researchQuestionDraft !== starterAnalysisQuestion') &&
        workspaceScript.text.includes('const question = input.value.trim() || starterAnalysisQuestion'),
      "Research conversations should use the starter question for first analysis without repeating it in the conversation or follow-up field."
    );
    assert(
      !workspaceScript.text.includes("recentlyViewedSearchID: instance.id") &&
        workspaceScript.text.includes("async function openRecentlyViewedInReader(searchInstance, entry)") &&
        workspaceScript.text.includes("await openSourceInReader(searchResultDetail(entry), paneIDForUtilityInstance(searchInstance))"),
      "Recently Viewed should open an exact-passage Reader."
    );
    const readerHeaderStyleSource =
      workspaceStyles.text.match(/\.reader-panel::before \{[\s\S]*?\n\}/)?.[0] || "";
    assert(
      readerHeaderStyleSource.includes("background: var(--surface);") &&
        readerHeaderStyleSource.includes("-webkit-backdrop-filter: none;") &&
        readerHeaderStyleSource.includes("backdrop-filter: none;") &&
        !readerHeaderStyleSource.includes("color-mix("),
      "Regular Reader headers should be fully opaque without a backdrop blur."
    );
    assert(
      workspaceScript.text.includes("function createSavedEvidenceHeading()") &&
        workspaceScript.text.includes("function populateSavedEvidenceSection(") &&
        workspaceScript.text.includes("collapsedEvidenceFolderIDs") &&
        workspaceScript.text.includes('"projectSectionExpansion"') &&
        workspaceScript.text.includes('projectSectionExpanded(folder, "savedEvidence", !collapsedFolderIDs.has(folderID))') &&
        workspaceScript.text.includes('persistProjectSectionExpansion(folder, "savedEvidence", expanded)') &&
        workspaceScript.text.includes('projectSectionExpanded(identity, "projectFacts", false)') &&
        workspaceScript.text.includes('persistProjectSectionExpansion(identity, "projectFacts", expanded)') &&
        workspaceScript.text.includes('projectSectionExpanded(identity, "research", false)') &&
        workspaceScript.text.includes('persistProjectSectionExpansion(identity, "research", expanded)') &&
        workspaceScript.text.includes("wireProjectSectionMotion(") &&
        workspaceScript.text.includes('toggle.className = "project-section-toggle-chevron saved-evidence-collapse-toggle"') &&
        workspaceScript.text.includes('search.className = "saved-evidence-search-toggle"') &&
        workspaceScript.text.includes("function savedEvidenceMatchesQuery(item, query)") &&
        workspaceScript.text.includes("instance.evidenceSearchOpen = true") &&
        workspaceScript.text.includes('searchInput.oninput = () => {') &&
        workspaceScript.text.includes('searchCloseButton.onclick = closeEvidenceSearch') &&
        workspaceStyles.text.includes(".saved-evidence-search-input {") &&
        workspaceStyles.text.match(/\.saved-evidence-search-input \{[\s\S]*?height: 42px;[\s\S]*?min-height: 42px;[\s\S]*?border-radius: var\(--radius-pill\);/) &&
        workspaceStyles.text.includes(".saved-evidence-search[hidden]") &&
        workspaceStyles.text.includes('.saved-project-evidence-body > .saved-inline-filters:not(:has(> :not([hidden])))') &&
        workspaceStyles.text.includes(".saved-tag-filter-menu.is-open .saved-tag-filter-actions") &&
        webRoot.text.includes('class="saved-tag-filter-clear"') &&
        workspaceScript.text.includes('const tagClearButton = panel.querySelector(".saved-tag-filter-clear")') &&
        workspaceScript.text.includes("availableTags.forEach((tag) => {") &&
        !workspaceScript.text.includes('["", ...availableTags].forEach((tag) => {'),
      "Saved Evidence should provide a revealable project search while retaining optional tag filtering."
    );
    assert(
      !webRoot.text.includes("account-plan-detail") &&
        !workspaceScript.text.includes("account-plan-detail") &&
        webRoot.text.includes("Read codes, search, recent history, 25 saved sections, 10 notes, continuity, and cross-device sync.") &&
        webRoot.text.includes("Unlimited saved sections and notes, Projects, Notebook, Report, professional exports, tags, and web offline access."),
      "Plan details should live in the Free and Pro descriptions instead of a redundant summary."
    );
    assert(!webRoot.text.includes("account-sync-card"), "settings should not render a redundant manual sync card");
    assert(!webRoot.text.includes("account-sync-now"), "settings should not render a redundant manual sync control");
    assert(
      webRoot.text.includes('class="settings-card settings-sync-conflicts-card"') &&
        webRoot.text.includes('class="settings-sync-conflicts-list" role="list"') &&
        workspaceScript.text.includes("const renderSyncConflictReview = () => {") &&
        workspaceScript.text.includes('["Use server", false]') &&
        workspaceScript.text.includes('["Keep mine", true]') &&
        workspaceScript.text.includes("Permitext resolved every safe match automatically.") &&
        workspaceScript.text.includes("Use server keeps the latest synced copy. Keep mine uploads this device's copy as the newest version.") &&
        workspaceScript.text.includes('collapsedSettingsCardIDs.delete("settings-sync-conflicts-title")') &&
        workspaceScript.text.includes('card?.scrollIntoView({ block: "center", behavior: "smooth" });') &&
        workspaceStyles.text.includes(".settings-sync-conflicts-list {") &&
        workspaceStyles.text.includes(".settings-sync-conflicts-card[hidden] {") &&
        workspaceStyles.text.includes(".settings-conflict-row {") &&
        !webRoot.text.includes("Sync Now"),
      "unresolved sync conflicts should remain reviewable without restoring manual sync"
    );
    assert(
      webRoot.text.includes("settings-footer-links") &&
      webRoot.text.includes('/web/styles.css?v=20260816-optional-evidence-roles-v277'),
      "settings footer links should stay centered with the current stylesheet"
    );
    assert(
      workspaceStyles.text.includes(
        "--research-conversation-background: color-mix(in srgb, var(--ios-accent-administrative) 10%, var(--background));"
      ) &&
        workspaceStyles.text.includes("background: var(--research-conversation-background);"),
      "Research Conversation should retain its distinct theme-aware column background."
    );
    assert(
      !researchProjectContextSource.includes("Additional research facts — one per line") &&
        projectResearchContextSource.includes("Additional research facts — one per line") &&
        projectResearchContextSource.includes('postResearch("/research/conversations/project-context"') &&
        workspaceScript.text.includes("appendProjectResearchContextEditor(content, identity, projectResearchConversation);") &&
        workspaceStyles.text.includes(".research-project-context {\n  display: grid;") &&
        workspaceStyles.text.includes("background: transparent;\n  box-shadow: none;") &&
        !researchProjectContextSource.includes("createResearchProjectSelect") &&
        workspaceScript.text.includes("function researchProjectChoices({") &&
        workspaceScript.text.includes('projectSelectWrap.className = "code-filter-menu research-conversation-project-picker";') &&
        workspaceScript.text.includes('projectToggle.className = "code-filter-menu-toggle research-conversation-project-toggle";') &&
        workspaceScript.text.includes('projectOptions.className = "research-conversation-project-options";') &&
        workspaceScript.text.includes('categoryLabel.className = "research-conversation-project-category";') &&
        workspaceScript.text.includes('categoryLabel.textContent = choice.category === "reference" ? "Saved collections" : "Projects";') &&
        workspaceScript.text.includes("folders.filter(folderIsProject).forEach") &&
        workspaceScript.text.includes('category: "reference"') &&
        workspaceScript.text.includes('optionButton.className = "research-conversation-project-option";') &&
        workspaceScript.text.includes("wireCodeFilterMenu(projectOptions, projectMenuState, {") &&
        workspaceScript.text.includes("assignResearchConversationProject(conversation, targetProjectID, {") &&
        workspaceScript.text.includes('warningContainer: projectSelectWrap.closest(".workspace-panel")') &&
        workspaceScript.text.includes("container: options.warningContainer") &&
        workspaceScript.text.includes('postResearch("/research/conversations/assign-project"') &&
        workspaceStyles.text.includes(".research-conversation-project-picker {") &&
        workspaceStyles.text.includes(".research-conversation-project-options {\n  display: block;") &&
        workspaceStyles.text.includes(".research-conversation-project-category {") &&
        workspaceStyles.text.includes(".research-conversation-project-option {\n  display: block;") &&
        workspaceStyles.text.includes(".research-conversation-project-option:last-child {\n  border-bottom: 0;") &&
        !workspaceStyles.text.includes(".research-conversation-project-option:nth-child(even)") &&
        workspaceStyles.text.includes(".research-conversation-project-option[aria-pressed=\"true\"] {") &&
        workspaceStyles.text.includes(".web-warning-backdrop.is-column-scoped {") &&
        workspaceStyles.text.includes(".research-list-panel {\n  position: relative;") &&
        workspaceStyles.text.includes(".saved-panel .saved-content > .saved-code-group:last-child .saved-row:last-child {\n  border-bottom: 0;") &&
        workspaceStyles.text.includes(".research-conversation-content {\n  display: grid;") &&
        workspaceStyles.text.includes("padding: 0;") &&
        workspaceStyles.text.includes(".research-composer {\n  position: relative;") &&
        workspaceScript.text.includes('composerBox.className = "research-composer-box";') &&
        workspaceScript.text.includes("composerBox.append(input, sendButton);") &&
        workspaceStyles.text.includes(".research-composer-box {\n  position: relative;\n  width: 100%;") &&
        workspaceStyles.text.includes("margin: 0;") &&
        workspaceStyles.text.includes("padding: var(--space-3) 0 var(--panel-padding);") &&
        workspaceStyles.text.includes(".research-send-button {\n  position: absolute;\n  right: var(--space-2);\n  bottom: var(--space-2);") &&
        workspaceStyles.text.includes("min-height: 42px;\n  border: 0;\n  border-radius: var(--radius-pill);\n  color: #ffffff;\n  box-shadow: none;"),
      "Project assignment should live on each Research row while the conversation pane remains context-only."
    );
    assert(
      !researchProjectContextSource.includes(
        "Project information and additional facts are context only."
      ) &&
        projectContextNoticeSource.includes('heading.textContent = "Project context"') &&
        projectContextNoticeSource.includes(
          "Project information and additional facts are context only. They are never treated as code authority or cited evidence."
        ) &&
        workspaceScript.text.includes(
          "if (projectResearchConversation) appendProjectContextNotice(content);"
        ) &&
        workspaceStyles.text.includes(".project-detail-content {\n  display: flex;\n  flex-direction: column;") &&
        workspaceStyles.text.includes(".project-context-notice {\n  margin-top: auto;"),
      "Project context guidance should live at the bottom of its active Project Studio rather than in Research Conversation."
    );
    assert(
      workspaceStyles.text.includes("body .panel-track > article.workspace-panel:not(.reader-panel),") &&
        workspaceStyles.text.includes("body .panel-track > article.workspace-panel:not(.reader-panel) * {") &&
        workspaceStyles.text.includes("font-size: 14px !important;"),
      "Non-Reader workspace columns should use a consistent 14px text size."
    );
    assert(
      !webRoot.text.includes("settings-code-section-select") &&
        !webRoot.text.includes(">Code Section</span>") &&
        !workspaceScript.text.includes("settingsCodePrefix") &&
        !iosSettingsSource.includes("codeSectionPicker") &&
        !iosSettingsSource.includes('settingsMenuRow(label: "Code Section")'),
      "Settings should not duplicate the code picker already available in each Reader"
    );
    assert(
      !iosSettingsSource.includes("syncCard") &&
        !iosSettingsSource.includes('CodeEyebrow(text: "Sync"') &&
        !iosSettingsSource.includes("Sync Now") &&
        iosLibraryViewModelSource.includes("private let foregroundAccountSyncInterval: TimeInterval = 30") &&
        iosLibraryViewModelSource.includes("func startForegroundAutomaticSync()") &&
        iosLibraryViewModelSource.includes("func performStartupAccountSyncIfNeeded() async") &&
        iosAppSource.includes("await library.performStartupAccountSyncIfNeeded()") &&
        iosAppSource.includes("library.startForegroundAutomaticSync()"),
      "iOS should rely on automatic sync without rendering a redundant Settings card"
    );
    assert(
      evidenceDiscoveryClientSource.includes('postResearch("/research/evidence/discover"') &&
      !evidenceDiscoveryClientSource.includes("Candidate · not selected") &&
        !evidenceDiscoveryClientSource.includes("evidence-candidate-why") &&
        !evidenceDiscoveryClientSource.includes("evidence-candidate-signals") &&
        !evidenceDiscoveryClientSource.includes("Review boundary") &&
        evidenceDiscoveryClientSource.includes("Additional source review required") &&
        evidenceDiscoveryClientSource.includes("Cannot prepare from text alone") &&
        evidenceDiscoveryClientSource.includes("Complete structured source included") &&
        evidenceDiscoveryClientSource.includes("Review official visual evidence") &&
        evidenceDiscoveryClientSource.includes("candidate.visualSources") &&
        evidenceDiscoveryClientSource.includes("candidate.selectedVisualSourceIDs") &&
        evidenceDiscoveryClientSource.includes("candidate.visualReviewConfirmed") &&
        evidenceDiscoveryClientSource.includes("evidenceCandidatePreparationReady(candidate)") &&
        evidenceDiscoveryClientSource.includes("candidate.richSourceIDs || []") &&
        evidenceDiscoveryClientSource.includes("Outside Construction Code Research") &&
        evidenceDiscoveryClientSource.includes("outsideItem.sourceURL") &&
        evidenceDiscoveryClientSource.includes("visualSourceIDs: candidate.selectedVisualSourceIDs || []") &&
        evidenceDiscoveryClientSource.includes("Use in Research") &&
        evidenceDiscoveryClientSource.includes("Selected for Research") &&
        evidenceDiscoveryClientSource.includes("Dismiss") &&
        evidenceDiscoveryClientSource.includes("Candidate ${candidateIndex + 1} of ${visibleCandidates.length}") &&
        evidenceDiscoveryClientSource.includes("Find ${nextCandidateBatchSize} more") &&
        evidenceDiscoveryClientSource.includes("Review dismissed (${rejectedCount})") &&
        evidenceDiscoveryClientSource.includes('reviewState === "rejected" ? "Restore" : "Dismiss"') &&
        workspaceScript.text.includes('postResearch("/research/conversations/candidate-disposition"') &&
        !workspaceScript.text.includes("Selected for exploratory Research") &&
        workspaceScript.text.includes("(embeddedEvidenceNoticeRegion || evidenceScroll).append(warning)") &&
        workspaceScript.text.includes("panes.push(await renderResearchConversation(state.researchConversationID))") &&
        !workspaceScript.text.includes('panel.classList.add("has-research-composer")') &&
        workspaceScript.text.includes("input.style.height = `${input.scrollHeight}px`") &&
        workspaceScript.text.includes("research-selected-evidence-notices") &&
        workspaceScript.text.includes("researchOpenContextIsCurrent(dispositionContext, { requireConversationID: true })") &&
        evidenceDiscoveryClientSource.includes("Previous") &&
        evidenceDiscoveryClientSource.includes("Next") &&
        evidenceDiscoveryClientSource.includes("View all") &&
        evidenceDiscoveryClientSource.includes("activeCandidateID") &&
        evidenceDiscoveryClientSource.includes("advanceAfterDisposition()") &&
        evidenceDiscoveryClientSource.includes("card.append(cardHeader, reviewControls, quote)") &&
        evidenceDiscoveryClientSource.includes("Add Selected Evidence") &&
        !evidenceDiscoveryClientSource.includes("Select at least one passage to add to Research.") &&
        evidenceDiscoveryClientSource.includes('targetConversationID ? "/research/conversations/evidence" : "/research/conversations/create"') &&
        evidenceDiscoveryClientSource.includes("{ conversationID: targetConversationID, selections: selectedPassages }") &&
        !evidenceDiscoveryClientSource.includes("const existingPassages = new Set") &&
        evidenceDiscoveryClientSource.includes("runResearchProgressSession(progress") &&
        workspaceScript.text.includes('fetch("/research/conversations/message"'),
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
      workspaceScript.text.includes("foregroundSyncDelay({ lastActivityAt: foregroundSyncLastActivityAt })") &&
        syncStateScript.text.includes("idleIntervalMs: 5 * 60_000") &&
        syncStateScript.text.includes("maximumStalenessMs: 15 * 60_000") &&
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
        workspaceScript.text.includes("function resolveWebWarningContainer") &&
        workspaceScript.text.includes('previousFocus.closest(".workspace-panel")') &&
        workspaceScript.text.includes("mountWebWarningBackdrop(backdrop, container, previousFocus)") &&
        workspaceScript.text.includes("mountWebWarningBackdrop(backdrop, null, previousFocus)") &&
        workspaceScript.text.includes("function openStripeRestoreDialog") &&
        workspaceScript.text.includes("function stripeRestoreIDError") &&
        workspaceScript.text.includes('dialog.setAttribute("role", "alertdialog")') &&
        workspaceScript.text.includes('dialog.setAttribute("aria-modal", "true")') &&
        workspaceScript.text.includes('confirmButton.className = "web-warning-button web-warning-confirm"') &&
        !workspaceScript.text.includes("window.confirm(") &&
        !workspaceScript.text.includes("window.alert(") &&
        !workspaceScript.text.includes("window.prompt("),
      "Web warnings no longer share the Clear canvas confirmation-dialog pattern."
    );
    assert(
      webRoot.text.includes('class="topbar-brand" aria-label="permitext"') &&
        webRoot.text.includes('class="topbar-brand-plan" hidden') &&
        workspaceScript.text.includes("function updateTopbarPlanBadge") &&
        workspaceScript.text.includes("topbarBrandPlan.hidden = !pro") &&
        workspaceScript.text.includes('topbarBrandPlan.textContent = pro ? "Pro" : ""') &&
        workspaceScript.text.includes('topbarBrand.setAttribute("aria-label", pro ? "permitext Pro plan" : "permitext")'),
      "The topbar plan badge must remain hidden unless the account has active Pro access."
    );
    assert(
      workspaceScript.text.includes("function enforceReaderPlanLimit") &&
        workspaceScript.text.includes("if (isProAccount() || state.readers.length <= 2) return false") &&
        workspaceScript.text.includes("addReaderButton.hidden = !isProAccount() && state.readers.length >= 2") &&
        workspaceScript.text.includes("collapseReadersButton.disabled = !hasColumns") &&
        workspaceScript.text.includes("const canAddReader = isProAccount() || state.readers.length < 2") &&
        workspaceScript.text.includes("isProAccount() || state.readers.length < 2") &&
        workspaceScript.text.includes("if (!isProAccount() && state.readers.length >= 2)"),
      "Free web accounts can expose or persist more than two Readers."
    );
    assert(
      workspaceScript.text.includes("const defaultReaderPaneWidth = 600") &&
        workspaceScript.text.includes("const defaultNonReaderPaneWidth = 400") &&
        workspaceScript.text.includes("const defaultUtilityPaneWidth = defaultNonReaderPaneWidth") &&
        workspaceScript.text.includes("const defaultSavedPaneWidth = 600") &&
        workspaceScript.text.includes('if (paneID === "utility:saved" || paneID.startsWith("utility:saved:")) return defaultSavedPaneWidth') &&
        workspaceScript.text.includes("function migrateLegacyPaneWidth(paneID, value)") &&
        workspaceScript.text.includes('(paneID === "utility:saved" || paneID.startsWith("utility:saved:")) && value === defaultUtilityPaneWidth') &&
        workspaceScript.text.includes("const value = migrateLegacyPaneWidth(paneID, storedValue)") &&
        workspaceScript.text.includes("if (value !== storedValue) state.paneWeights[paneID] = value") &&
        workspaceScript.text.includes("const defaultDetailPaneWidth = 600") &&
        workspaceScript.text.includes("const defaultWorkboardPaneWidth = 750") &&
        workspaceScript.text.includes("const defaultNotebookPaneWidth = 600") &&
        workspaceScript.text.includes("const defaultReportDraftPaneWidth = 600") &&
        workspaceScript.text.includes("const defaultSettingsPaneWidth = 600") &&
        workspaceScript.text.includes("const defaultResearchPaneWidth = 600") &&
        workspaceScript.text.includes("const defaultCodeDecisionPaneWidth = 600") &&
        workspaceScript.text.includes("return defaultNonReaderPaneWidth"),
      "Code Decision workflow columns no longer preserve their intended defaults."
    );
    assert(
      workspaceStyles.text.includes("--project-pane-band-height: calc(var(--panel-padding) + var(--panel-title-row-height) + var(--space-3))") &&
        workspaceStyles.text.match(/--project-pane-band-background: color-mix\(in srgb, var\(--project-color\) 42%, var\(--surface\)\);/g)?.length === 5 &&
        workspaceStyles.text.includes(".project-detail-actions {") &&
        workspaceStyles.text.includes("margin-top: var(--space-3);") &&
        workspaceStyles.text.includes(".project-detail-panel::before,\n.notebook-panel::before,\n.report-draft-panel::before {") &&
        workspaceStyles.text.includes("height: var(--project-pane-band-height)") &&
        workspaceStyles.text.includes("background: var(--project-pane-band-background)") &&
        workspaceStyles.text.includes(".project-detail-content > .project-studio-section + .project-studio-section {\n  margin-top: var(--space-5);\n  padding-top: var(--space-5);\n  border-top: 1px solid var(--border);") &&
        workspaceStyles.text.includes(".workboard-panel {") &&
        workspaceStyles.text.includes("background: var(--surface-raised);") &&
        !workspaceStyles.text.includes("--notebook-project-background"),
      "Project-owned panes no longer limit the Project color to one aligned header band."
    );
    assert(
      workspaceScript.text.includes("connectionStatus.dataset.state = statusKind") &&
        workspaceScript.text.includes('conflicts === 1 ? "1 sync conflict"') &&
        workspaceScript.text.includes('pending === 1 ? "1 pending"') &&
        workspaceScript.text.includes('connectionStatus.setAttribute("role", conflictActionAvailable ? "button" : "status")') &&
        workspaceScript.text.includes('connectionStatus?.addEventListener("click", openConnectionStatusConflictReview)') &&
        workspaceScript.text.includes('connectionStatus?.addEventListener("keydown"') &&
        workspaceScript.text.includes('if (connectionStatus?.dataset.state !== "conflict") return;') &&
        workspaceScript.text.includes('await focusUtility("settings", ".settings-sync-conflicts-card .settings-card-toggle")') &&
        webRoot.text.includes('id="connection-status" role="status" aria-live="polite"'),
      "Exceptional sync states no longer provide a clear live signal with conflict-only Settings access."
    );
    assert(
      workspaceScript.text.includes("async function convergeServerNewerSyncConflicts(account)") &&
        workspaceScript.text.includes("function syncedMutationSupersedesConflict(entry)") &&
        workspaceScript.text.includes('import { syncConflictRecordsMatch } from "./sync-conflict-resolution.js?v=20260809-code-decision-v5"') &&
        workspaceScript.text.includes("syncConflictRecordsMatch(local.record, server.record)") &&
        workspaceScript.text.includes("entry.accountUserID === account.userID && syncedMutationSupersedesConflict(entry)") &&
        workspaceScript.text.includes("await convergeServerNewerSyncConflicts(account)") &&
        workspaceScript.text.includes("function projectEvidenceCount(projectSections, project)") &&
        workspaceScript.text.includes("discardLocalMutationOverlay(entry.mutation)") &&
        workspaceScript.text.includes("await replaceLocalWorkboard(projectID, syncedWorkboardForProject(projectID))"),
      "Web sync must only auto-converge server records that contain no unique local edits."
    );
    assert(
      workspaceScript.text.includes('if (value === "project" && !hasCapability("projects"))') &&
        workspaceScript.text.includes('if (requestedType === "project" && !hasCapability("projects"))') &&
        workspaceScript.text.includes('selectedFolderType = "reference"'),
      "Free users must be offered Reference folders while Project creation remains plan-gated."
    );
    assert(
      workspaceScript.text.includes("function refreshOpenAnnotationProjectEditors()") &&
        workspaceScript.text.includes('track.querySelectorAll(".reader-notes-sheet.is-open:not([hidden])")') &&
        workspaceScript.text.includes('track.querySelectorAll(".section-detail-panel")') &&
        workspaceScript.text.match(/overlay\.remove\(\);\s+await transitionWorkspace\("utility", \{\s+refreshPaneIDs: projectOverviewRefreshPaneIDs\(/) &&
        workspaceScript.text.match(/refreshPaneIDs: projectOverviewRefreshPaneIDs\([\s\S]*?\);\s+refreshOpenAnnotationProjectEditors\(\);/),
      "Creating or editing a Project should refresh Project pills in open Reader notes and Search details."
    );
    assert(
      workspaceStyles.text.match(/\.reader-notes-sheet \{[\s\S]*?right: calc\(var\(--panel-padding\) \+ var\(--reader-scrollbar-rail-width\) - var\(--divider-width\)\);[\s\S]*?bottom: calc\(var\(--panel-padding\) \+ var\(--space-2\)\);[\s\S]*?left: calc\(var\(--panel-padding\) - var\(--divider-width\)\);[\s\S]*?border: 0;[\s\S]*?border-radius: clamp\(22px, 4vw, 30px\);/) &&
        workspaceScript.text.includes("const maxHeight = Math.max(cssMinHeight, sheetBounds.bottom - panelBounds.top - readerTrackTop);") &&
        workspaceScript.text.includes("const height = sheetBounds.bottom - moveEvent.clientY;"),
      "Reader paragraph notes must remain an inset rounded bottom card while preserving bounded vertical expansion."
    );
    assert(
      workspaceScript.text.includes("function captureReaderScrollPositions()") &&
        workspaceScript.text.includes("function restoreReaderScrollPositions(positions)") &&
        workspaceScript.text.includes("panel.dataset.readerContentKey = readerContentScrollKey(reader);") &&
        workspaceScript.text.match(/async function renderWorkspace\(options = \{\}\) \{[\s\S]*?const readerScrollPositions = suppressReaderScrollRestore \? new Map\(\) : captureReaderScrollPositions\(\);/) &&
        workspaceScript.text.match(/appendPaneSequence\(panes\);\s+restoreReaderScrollPositions\(readerScrollPositions\);/) &&
        workspaceScript.text.includes("panel.dataset.readerContentKey !== position.contentKey"),
      "Full workspace refreshes no longer preserve independent Reader scroll positions for unchanged content."
    );
    assert(
      workspaceScript.text.includes('"Sign out with unfinished sync?"') &&
        workspaceScript.text.includes("if (pending > 0 || conflicts > 0)") &&
        workspaceScript.text.includes("if (!confirmed) return;"),
      "Sign-out no longer warns only when queued changes or unresolved conflicts exist."
    );
    assert(
      workspaceScript.text.includes(
        '"Sign in to sync saved sections, notes, and Projects across your devices."'
      ) &&
        !workspaceScript.text.includes(
          '"Sign in to attach local saved work to your account and use cross-device sync."'
        ),
      "The signed-out account card reverted to internal sync language."
    );
    assert(
      workspaceScript.text.includes("return `https://permitext.com/open/section/${normalizedID}`;") &&
        !workspaceScript.text.includes("return `https://permitext-sync.vercel.app/open/section/${normalizedID}`;"),
      "Web share controls no longer generate permitext.com section links."
    );
    assert(
      workspaceScript.text.includes('const researchChatPlaceholder = "AI-assisted research — not an official interpretation"') &&
        (workspaceScript.text.match(/input\.placeholder = researchChatPlaceholder;/g) || []).length === 2 &&
        !workspaceScript.text.includes('research-trust-notice') &&
        !workspaceScript.text.includes("appendTrustNotice") &&
        privacyPolicy.text.includes("grounds code conclusions in applicable enacted text") &&
        privacyPolicy.text.includes("Supporting sources are identified separately") &&
        privacyPolicy.text.includes("private notes are excluded") &&
        privacyPolicy.text.includes("Research evidence sent for generation") &&
        !workspaceScript.text.includes('trustBanner.className = "research-trust-banner"') &&
        !workspaceScript.text.includes('noteLabel.textContent = "Private note · not code text"'),
      "Research trust labeling should remain in the composer while the detailed boundary lives in the Privacy Policy."
    );
    assert(
      workspaceScript.text.includes('findButton.textContent = "Search"') &&
        workspaceScript.text.includes("includeUnassigned: !scopedProjectID") &&
        workspaceScript.text.includes("if (!scopedProjectID) controls.append(projectSelect)") &&
        workspaceScript.text.includes('await focusUtility("analysis", ".evidence-discovery textarea")') &&
        !workspaceScript.text.includes('{ label: "Open AI-assisted Research"'),
      "Project Research no longer owns a scoped Search entry point."
    );
    assert(
      workspaceScript.text.includes("function bindResearchTextSelection") &&
        workspaceScript.text.includes('analyzeButton.textContent = state.researchConversationID ? "Start new Research" : "Start Research"') &&
        workspaceScript.text.includes('addButton.textContent = "Add as supporting evidence"') &&
        !workspaceScript.text.includes('hint.className = "research-selection-hint"') &&
        workspaceScript.text.includes('unassignedLabel: "Unassigned — no Project context"') &&
        workspaceScript.text.includes("selections: passages.map") &&
        workspaceScript.text.includes('groupHeading.dataset.researchSelectionExclude = "true"') &&
        workspaceScript.text.includes('sectionHeading.dataset.researchSelectionExclude = "true"') &&
        workspaceScript.text.includes('postResearch("/research/conversations/rename"') &&
        workspaceScript.text.includes('renameButton.title = "Rename conversation"') &&
        workspaceScript.text.includes("String(right.createdAt || \"\").localeCompare(String(left.createdAt || \"\"))") &&
        workspaceScript.text.includes("researchSelectionMenuInteracting = true") &&
        !workspaceScript.text.includes('heading.textContent = "Conversations"') &&
        !workspaceScript.text.includes("Highlight enacted text in any Reader, search detail, or project section to begin.") &&
        workspaceScript.text.includes('postResearch("/research/conversations/create"') &&
        workspaceScript.text.includes('fetch("/research/conversations/message"') &&
        researchConversationRendererSource.includes("dialoguePane.append(thread)") &&
        researchConversationRendererSource.includes("dialoguePane.append(composer)") &&
        !workspaceScript.text.includes("opening this conversation has not called an AI model") &&
        !workspaceScript.text.includes("research-conversation-prompt"),
      "Web Research no longer exposes selection-first, persistent conversations without an eager model call."
    );
    assert(
      workspaceScript.text.includes(
        'if (paneID === "utility:analysis" || paneID.startsWith("research:conversation:"))'
      ) &&
      workspaceScript.text.includes(
        'return ["utility:analysis", paneIDForResearchConversation()].filter((id) => id && active.has(id));'
      ),
      "The Research list and its adjacent conversation no longer move as one stable group."
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
      workspaceScript.text.includes("const resultCount = filteredResults.length;") &&
        !workspaceScript.text.includes("const reportedTotal = Number(payload.totalResults);"),
      "Search summary count should match the exact results actually rendered."
    );
    assert(
      workspaceScript.text.includes("function createSavedBulkSelectionController") &&
        workspaceScript.text.includes('select.className = "saved-evidence-select-toggle"') &&
        workspaceScript.text.includes('remove.className = "saved-evidence-delete-selection"') &&
        workspaceScript.text.includes('cancel.className = "saved-evidence-cancel-selection"') &&
        workspaceScript.text.includes("selectionController?.beginRender()") &&
        workspaceScript.text.includes("removeButton.hidden = selectedCount === 0") &&
        !workspaceScript.text.includes('removeButton.className = "saved-row-remove"') &&
        workspaceStyles.text.includes(".saved-evidence-heading-actions") &&
        workspaceScript.text.includes('[["project", "New Project…"], ["reference", "New Reference…"]]') &&
        workspaceScript.text.includes('button.className = "reader-notes-project-option"') &&
        workspaceScript.text.includes('confirmButton.className = "reader-notes-project-confirm"'),
      "Saved Evidence bulk deletion or new-project saving controls are missing."
    );
    assert(
      workspaceScript.text.includes("function consolidatedSavedAnnotations") &&
        workspaceScript.text.includes("function mergeSavedColumnItems") &&
        workspaceScript.text.includes("async function hydrateSavedColumnItems") &&
        workspaceScript.text.includes("function savedSectionIsNestedListParagraph") &&
        workspaceScript.text.includes("isNestedListParagraph: savedSectionIsNestedListParagraph(chapter, section)") &&
        workspaceScript.text.includes("function mergeEquivalentSavedColumnRows") &&
        workspaceScript.text.includes("bookmark.annotationBlockID = blockID") &&
        workspaceScript.text.includes("item.annotationBlockID") &&
        workspaceScript.text.includes("const combinedItems = mergeSavedColumnItems(savedItems, annotatedItems)") &&
        workspaceScript.text.includes("rawCandidates.slice(0, allSavedLimit)") &&
        !workspaceScript.text.includes("savedItems.slice(0, 48)") &&
        workspaceScript.text.includes("const applySavedView = async () =>") &&
        workspaceScript.text.includes('button.className = "saved-load-more-button"') &&
        workspaceScript.text.includes("function savedEvidenceMatchesQuery(item, query)") &&
        workspaceScript.text.includes("codeDisplayLabel(prefix)") &&
        workspaceScript.text.includes('const searchInput = panel.querySelector(".saved-evidence-search-input")') &&
        workspaceScript.text.includes("instance.codeFilters = [];") &&
        workspaceScript.text.includes("collapsedCodePrefixes: searchActive ? [] : savedInstance.collapsedCodePrefixes") &&
        workspaceScript.text.includes("if (searchActive) return;") &&
        workspaceScript.text.includes("function mountProjectOpeningPane") &&
        workspaceScript.text.includes('panel.className = "workspace-panel project-detail-panel project-detail-loading"') &&
        workspaceScript.text.includes("savedContentComparisonText") &&
        workspaceScript.text.includes("previewText: savedContentComparisonText.slice(0, 240)") &&
        workspaceScript.text.includes("selectedFolderSectionEvidenceKeys") &&
        workspaceScript.text.includes('!normalizeAnnotationBlockID(item.blockID)') &&
        workspaceScript.text.includes('projectSavedScope: "section"') &&
        workspaceScript.text.includes('item.projectSavedScope === "section"') &&
        workspaceScript.text.includes("/code/sections/${encodeURIComponent(detail.sectionID)}") &&
        workspaceScript.text.includes("function sortSavedItems") &&
        workspaceScript.text.includes('chapterHeader.className = "saved-chapter-header"') &&
        workspaceScript.text.includes('preview.className = "saved-paragraph-preview"') &&
        workspaceScript.text.includes('title.className = "saved-section-title"') &&
        workspaceScript.text.includes('row.classList.add("is-list-paragraph")') &&
        !workspaceScript.text.includes('folders.className = "saved-row-folders"') &&
        !workspaceStyles.text.includes(".saved-row-folders") &&
        workspaceStyles.text.includes(".saved-section-row.is-list-paragraph .saved-section-title") &&
        workspaceScript.text.includes('sortSavedItems(filteredItems, "codeOrder")') &&
        workspaceScript.text.includes('renderSavedItemsByCode(content, orderedItems, paneID, {') &&
        workspaceScript.text.includes("const removableSavedItems = selectedFolder && !savedInstance.showAllSaved") &&
        workspaceScript.text.includes("removableSavedItems: Boolean(selectionController)"),
      "Saved rows no longer match the iOS code, chapter, and code-order structure."
    );
    assert(
      workspaceScript.text.includes("async function saveReaderPassage(panel, section, reader, target, options = {})") &&
        workspaceScript.text.includes("await persistSectionBookmark(payload, true, { refreshSavedPanes: false })") &&
        workspaceScript.text.includes("project = activeProjectForReaderSave()") &&
        workspaceScript.text.includes("await persistSectionInProject(project, payload)") &&
        workspaceScript.text.includes('addNote.textContent = noteValueForTarget(target).trim() ? "Open note" : "Add note"'),
      "Reader passage saving is no longer immediate, Project-aware, and followed by an optional Note action."
    );
    assert(
        workspaceScript.text.includes('if (window.getSelection && String(window.getSelection()).trim()) return;') &&
        workspaceScript.text.includes('wrapper.classList.toggle("is-actions-active")') &&
        workspaceScript.text.includes('await saveReaderPassage(panel, section, reader, target, { openNote: true })') &&
        workspaceScript.text.includes('bookmarkButton.setAttribute("aria-label", saved ? "Saved passage" : "Save passage")') &&
        workspaceScript.text.includes('savedMarker.className = "reader-section-saved-marker"') &&
        workspaceScript.text.includes('savedMarker.hidden = !savedSection') &&
        workspaceScript.text.includes('function savedSectionRecord(section, codeVersion = "")') &&
        workspaceScript.text.includes('blockID: normalizeAnnotationBlockID(section.blockID)') &&
        workspaceScript.text.includes('return `${version}:${sectionID}:${blockID}`') &&
        workspaceScript.text.includes('const blockID = normalizeAnnotationBlockID(sectionPayload.blockID)') &&
        workspaceScript.text.includes('const savedTargetChanged = wasSaved') &&
        workspaceScript.text.includes('normalizeAnnotationBlockID(item.blockID || item.anchorID || item.contentBlockID) === targetBlockID') &&
        !workspaceScript.text.includes('if (saved && blockID && normalizeAnnotationBlockID(savedRecord?.blockID) !== blockID)') &&
        !workspaceScript.text.includes('className = "saved-section-status"') &&
        workspaceScript.text.includes('const saved = await persistSectionBookmark(sectionPayload, true, { refreshSavedPanes: false })') &&
        !workspaceScript.text.includes('if (!isSectionSaved(sectionPayload)) {\n              const saved = await persistSectionBookmark') &&
        workspaceScript.text.includes('(savedRecord ? normalizeAnnotationBlockID(blocks[0]?.id') &&
        workspaceScript.text.includes('const wrapperBlockID = normalizeAnnotationBlockID(wrapper.dataset.commentBlockId)') &&
        workspaceScript.text.includes('const showBookmark = Boolean(savedRecord && wrapperBlockID)') &&
        workspaceScript.text.includes('sectionWrapper.dataset.codeVersion = syncCodeVersion') &&
        workspaceScript.text.includes('wrapper.dataset.commentCodeVersion = syncCodeVersion(target.codeVersion)') &&
        workspaceScript.text.includes('wrapper.classList.toggle("has-saved-section", showBookmark)') &&
        workspaceScript.text.includes('button.setAttribute("aria-label", showBookmark ? "Saved passage" : "Save passage")') &&
        !workspaceScript.text.includes('const bookmarkWrapper = wrappers.find') &&
        workspaceScript.text.includes('marker.hidden = !showSectionMarker') &&
        workspaceStyles.text.includes(".reader-section-saved-marker") &&
        workspaceStyles.text.includes(".reader-section-saved-marker[hidden]") &&
        !workspaceScript.text.includes("restoreReaderNotesSheet"),
      "Paragraph selection, immediate saving, notes, or Reader saved markers no longer preserve passage identity."
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
      workspaceScript.text.includes('headerActions.className = "panel-actions project-detail-header-actions"') &&
        workspaceScript.text.includes("const backButton = appendDetailIconButton(headerActions, {") &&
        workspaceScript.text.includes("chrome.append(headingGroup, headerActions, actions);") &&
        workspaceStyles.text.match(/\.project-detail-header-actions \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;/),
      "Project Back should stay in the standard top-right column action position."
    );
    assert(
      workspaceScript.text.includes("const deletion = deletedProjectSectionMutationForItem(project, item)") &&
        workspaceScript.text.includes("await pushMutation(deletion)") &&
        workspaceScript.text.includes("await removeSectionFromAllProjects(sectionPayload)") &&
        workspaceScript.text.includes("await removeSectionFromProject(project, link, { removeBookmark: false })") &&
        workspaceScript.text.includes("await persistSectionBookmark(item, false, { refreshSavedPanes: false })") &&
        workspaceScript.text.includes("syncReaderNoteBookmarkButtons(sectionID, false, item.codeVersion)"),
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
        workspaceScript.text.includes('typeof panel.__refreshProjectMembership === "function"') &&
        workspaceScript.text.includes("panel.__refreshProjectMembership = () =>") &&
        workspaceScript.text.includes("return refreshSavedPanelInPlace(paneID, {") &&
        workspaceScript.text.includes("reconcileProjectStudio: false") &&
        workspaceScript.text.includes("const scrollTop = scrollContainer?.scrollTop || 0") &&
        workspaceScript.text.includes("if (scrollContainer) scrollContainer.scrollTop = scrollTop") &&
        workspaceScript.text.includes("return currentContentSummary().annotations") &&
        workspaceScript.text.includes("leftIsLocal === rightIsLocal ? 0 : leftIsLocal ? -1 : 1") &&
        workspaceScript.text.includes('button.setAttribute("aria-label", "Bookmarked")'),
      "Local-first notes or project saves can be replaced by stale sync data or leave stale Reader bookmark labels."
    );
    assert(
      workspaceScript.text.includes("{ ...project, updatedAt: deletedAt, deletedAt }") &&
        workspaceScript.text.includes("// Keep the local deletion tombstone while sync recovers.") &&
        workspaceScript.text.match(/filter\(\(project\) => !project\.deletedAt\)\s*\.sort/),
      "Project deletion no longer completes locally while account sync is pending."
    );
    assert(
      workspaceScript.text.includes("function closeDeletedProjectDetails()") &&
        workspaceScript.text.includes("closeDeletedProjectDetails();") &&
        workspaceScript.text.includes("deletedDetails.forEach((detail) => closeProjectDetailForProject(detail))"),
      "Remote project deletion can leave a stale project detail or Workboard column open."
    );
    assert(
      workspaceScript.text.includes("function selectProjectInSaved(project, preferredPaneID = \"\")") &&
        workspaceScript.text.includes("const savedPaneID = selectProjectInSaved(identity, sourcePaneID)") &&
        workspaceScript.text.includes("scrollPaneIntoView(savedPaneID)"),
      "Project entry points no longer select and reveal the Project in Saved."
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

    const enactedAccentVariables = [
      "energy",
      "electrical",
      "existing-building",
      "fire",
      "historical",
      "housing",
      "environmental",
      "land-use",
      "housing-buildings",
      "current-consolidation",
      "local-law"
    ];
    const enactedAccentValues = enactedAccentVariables.map((name) =>
      workspaceStyles.text.match(new RegExp(`--ios-accent-${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1]
    );
    assert(
      workspaceScript.text.includes('prefix: "ECC", label: "Energy Conservation Code (2025)", theme: "energy"') &&
        workspaceScript.text.includes('prefix: "EC", label: "Electrical Code — NYC amendments (2025)", theme: "electrical"') &&
        workspaceScript.text.includes('theme: "existing-building"') &&
        workspaceScript.text.includes('prefix: "FC", label: "Fire Code", theme: "fire"') &&
        workspaceScript.text.includes('prefix: "BC68", label: "1968 Building Code (historical)", theme: "historical"') &&
        workspaceScript.text.includes('prefix: "HMC", label: "Housing Maintenance Code", theme: "housing"') &&
        workspaceScript.text.includes('prefix: "T24", label: "Administrative Code Title 24 — Environmental Protection", theme: "environmental"') &&
        workspaceScript.text.includes('prefix: "T25", label: "Administrative Code Title 25 — Land Use", theme: "land-use"') &&
        workspaceScript.text.includes('prefix: "T26", label: "Administrative Code Title 26 — Housing and Buildings", theme: "housing-buildings"') &&
        workspaceScript.text.includes('prefix: "T28", label: "Administrative Code Title 28 — Current Consolidation", theme: "current-consolidation"') &&
        workspaceScript.text.includes('prefix: "LL", label: "Construction-Related Local Laws", theme: "local-law"') &&
        enactedAccentVariables.every((theme) => workspaceStyles.text.includes(`.code-theme-${theme} {`)) &&
        enactedAccentValues.every(Boolean) &&
        new Set(enactedAccentValues.map((value) => value.toLowerCase())).size === enactedAccentVariables.length,
      "Each enacted code collection should retain its own reader accent theme."
    );
    assert(
      !workspaceScript.text.includes("function wireSettingsSelectControl(panel, selector, label)") &&
        !workspaceScript.text.includes("function setSettingsInlineControlOpen(toggle, options, open, label)"),
      "Retired Code Preferences controls should not leave unused Settings handlers."
    );
    assert(
      !workspaceStyles.text.includes(".search-all-codes"),
      "Search still styles the retired All Codes button."
    );
    assert(
      workspaceStyles.text.match(/\.search-panel \.search-box \{[\s\S]*?border-radius: var\(--radius-pill\);/) &&
        workspaceStyles.text.match(/\.search-dock \{[\s\S]*?padding: var\(--space-2\) var\(--panel-padding\) var\(--space-3\);/),
      "The Search field should align with the Saved Projects pill and retain fully rounded sides."
    );
    assert(
      workspaceStyles.text.match(/\.search-jump-section \.search-history-label,[\s\S]*?\.search-history-section\.is-recent \.search-history-label \{[\s\S]*?font-size: 13\.3333px !important;/) &&
        workspaceStyles.text.match(/\.search-history-scroll-list \{[\s\S]*?max-height: 320px;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior-x: auto;[\s\S]*?overscroll-behavior-y: contain;/) &&
        workspaceStyles.text.match(/\.search-jump-list \{[\s\S]*?display: grid;[\s\S]*?gap: var\(--space-1\);/) &&
        workspaceStyles.text.match(/\.search-jump-tile \{[\s\S]*?height: 112px;[\s\S]*?min-height: 112px;[\s\S]*?border-bottom: 1px solid var\(--border\);[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/) &&
        workspaceStyles.text.match(/\.search-jump-open \{[\s\S]*?gap: 1px;[\s\S]*?height: 112px;[\s\S]*?min-height: 112px;[\s\S]*?padding: var\(--space-1\);/) &&
        workspaceScript.text.includes('code.className = "search-jump-code"') &&
        workspaceScript.text.includes("isNestedListParagraph = !rawPreview && Boolean(titleWithoutNumber)") &&
        workspaceScript.text.includes('String(entry.sectionNumber || "Paragraph").trim()') &&
        workspaceScript.text.includes('preview.className = "search-jump-preview"') &&
        workspaceScript.text.includes("openButton.append(code, title, preview)") &&
        workspaceStyles.text.match(/\.search-jump-preview \{[\s\S]*?-webkit-line-clamp: 3;/) &&
        !workspaceScript.text.includes('number.className = "search-jump-number"'),
      "Search history lists no longer use the requested heading size and independent vertical scrolling."
    );
    assert(
      workspaceScript.text.includes("if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;") &&
        workspaceScript.text.includes("bindHorizontalWheelScroll(track);"),
      "Horizontal trackpad gestures over nested Search lists should continue moving the workspace without taking over vertical list scrolling."
    );
    assert(
      workspaceScript.text.includes("function organizedSpecialtyProvisionBlocks") &&
        workspaceScript.text.includes('if (!["ECC", "EC"].includes(codePrefix)') &&
        workspaceScript.text.includes('strong.className = "specialty-provision-heading"') &&
        workspaceStyles.text.match(/\.section-html \.specialty-provision-heading \{[\s\S]*?display: block;[\s\S]*?margin-bottom: var\(--space-2\);[\s\S]*?font-weight: 700;/),
      "Energy and Electrical Code subsection titles should be separated and emphasized like the established construction-code hierarchy."
    );
    assert(
      workspaceStyles.text.match(/\.search-code-filter \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?overflow: visible;/) &&
        workspaceStyles.text.match(/\.code-filter-menu \.search-code-filter,[\s\S]*?max-height: 0;[\s\S]*?max-height 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\),[\s\S]*?opacity 260ms ease,/) &&
        workspaceStyles.text.match(/\.code-filter-menu\.is-open \.search-code-filter,[\s\S]*?max-height: var\(--code-filter-menu-height, 240px\);/) &&
        workspaceStyles.text.match(/\.code-filter-menu-toggle \{[\s\S]*?justify-content: space-between;[\s\S]*?border-radius: var\(--radius-pill\);/) &&
        workspaceStyles.text.match(/\.code-filter-menu-toggle\[aria-expanded="true"\] \.code-filter-chevron-up \{[\s\S]*?display: block;/) &&
        workspaceStyles.text.match(/\.search-panel \.search-box \{[\s\S]*?border: 0;/) &&
        workspaceStyles.text.match(/\.search-panel \.search-box:has\(\.search-input:focus-visible\) \{[\s\S]*?outline: 2px solid/) &&
        workspaceStyles.text.match(/\.search-code-filter \.search-filter-chip \{[\s\S]*?width: 100%;[\s\S]*?justify-self: stretch;[\s\S]*?border-radius: var\(--radius-pill\);[\s\S]*?font-size: 12px !important;[\s\S]*?font-weight: 400;[\s\S]*?text-align: center;/) &&
        workspaceStyles.text.match(/\.search-filter-chip \{[\s\S]*?background: color-mix\(in srgb, var\(--text-tertiary\) 16%, transparent\);/) &&
        workspaceStyles.text.match(/\.search-code-filter \.search-filter-chip\[aria-pressed="true"\] \{[\s\S]*?font-weight: 400;/) &&
        workspaceScript.text.includes('menu.classList.add("is-open")') &&
        workspaceScript.text.includes('menu.classList.remove("is-open")') &&
        workspaceScript.text.includes('menu.style.setProperty("--code-filter-menu-height"') &&
        workspaceScript.text.includes("resizeObserver.observe(toggle.closest(\".code-filter-menu\"))") &&
        workspaceScript.text.includes("window.setTimeout(hideFilterRail, 500)") &&
        !workspaceScript.text.includes("bindHorizontalWheelScroll(filterRail)"),
      "Search code filters should expand from a single summary pill into two equal-width columns."
    );
    assert(
      workspaceStyles.text.match(/\.saved-code-filter \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(140px, 1fr\)\);[\s\S]*?grid-auto-flow: row;[\s\S]*?column-gap: calc\(var\(--space-3\) \* 2\);[\s\S]*?overflow: visible;[\s\S]*?background-image: none;/) &&
        workspaceStyles.text.match(/\.saved-code-filter \.saved-filter-chip \{[\s\S]*?width: 100%;[\s\S]*?justify-self: stretch;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent !important;[\s\S]*?font-size: 12px !important;[\s\S]*?text-align: left;/) &&
        workspaceStyles.text.match(/\.saved-code-filter \.saved-filter-chip\[aria-pressed="true"\] \{[\s\S]*?font-weight: 600;/) &&
        workspaceStyles.text.match(/\.code-filter-menu \.saved-project-list,[\s\S]*?\.code-filter-menu \.saved-tag-filter,[\s\S]*?\.code-filter-menu \.research-conversation-project-options \{[\s\S]*?max-height: 0;/) &&
        workspaceStyles.text.match(/\.code-filter-menu\.is-open \.saved-project-list,[\s\S]*?\.code-filter-menu\.is-open \.saved-tag-filter,[\s\S]*?\.code-filter-menu\.is-open \.research-conversation-project-options \{[\s\S]*?max-height: var\(--code-filter-menu-height, 240px\);/) &&
        workspaceStyles.text.match(/\.code-filter-menu\.is-restoring \.search-code-filter,[\s\S]*?\.code-filter-menu\.is-restoring \.saved-tag-filter,[\s\S]*?\.code-filter-menu\.is-restoring \.research-conversation-project-options \{[\s\S]*?transition: none;/) &&
        workspaceStyles.text.match(/\.saved-projects-section \{[\s\S]*?margin-top: var\(--space-2\);[\s\S]*?border-radius: var\(--saved-projects-card-radius\);[\s\S]*?background: var\(--menu-subtle-surface\);/) &&
        workspaceStyles.text.match(/\.saved-projects-actions \{[\s\S]*?position: absolute;[\s\S]*?display: none;/) &&
        workspaceStyles.text.match(/\.saved-projects-menu\.is-open \.saved-projects-actions \{[\s\S]*?display: flex;/) &&
        workspaceStyles.text.match(/\.saved-tag-filter \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(140px, 1fr\)\);[\s\S]*?grid-auto-flow: row;[\s\S]*?column-gap: calc\(var\(--space-3\) \* 2\);[\s\S]*?background-image: none;/) &&
        workspaceStyles.text.match(/\.code-filter-menu\.is-open \.saved-tag-filter \{[\s\S]*?max-height: min\(var\(--code-filter-menu-height, 240px\), 152px\);[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior-y: contain;/) &&
        workspaceStyles.text.match(/\.saved-tag-filter-chip \{[\s\S]*?width: 100%;[\s\S]*?min-height: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent !important;[\s\S]*?font-size: 12px !important;[\s\S]*?text-align: left;/) &&
        workspaceStyles.text.match(/\.saved-tag-filter-chip::before \{[\s\S]*?content: none;/) &&
        !workspaceStyles.text.includes('.saved-tag-filter-chip:nth-child(even)') &&
        !workspaceStyles.text.includes(".saved-filter-resize-handle") &&
        !workspaceScript.text.includes("wireSavedFilterResizeHandle") &&
        workspaceScript.text.includes('stateKey: "projectsMenuOpen"') &&
        workspaceScript.text.includes('stateKey: "tagsMenuOpen"') &&
        workspaceScript.text.includes('menu.classList.add("is-restoring")') &&
        workspaceScript.text.includes("void filterRail.offsetHeight") &&
        workspaceScript.text.includes("instant: true") &&
        !workspaceScript.text.includes("savedFilterScrollPositions") &&
        !workspaceScript.text.includes("bindHorizontalWheelScroll(tagRail)") &&
        !workspaceScript.text.includes("bindHorizontalWheelScroll(codeRail)"),
      "Saved menu grids should auto-fit only as many aligned columns as their items and available width support."
    );
    assert(
      workspaceStyles.text.match(/\.search-result-summary \{[\s\S]*?justify-content: center;[\s\S]*?color: #ffffff;[\s\S]*?text-align: center;/),
      "Search result count should remain white and centered below the code filter list."
    );
    assert(
      workspaceScript.text.includes("function codeBlockHasVisibleContent(block)") &&
        workspaceScript.text.includes('node.querySelector("img, table")') &&
        workspaceScript.text.includes("isZoningSection ? blocks.filter(codeBlockHasVisibleContent) : blocks") &&
        workspaceScript.text.includes('startsWith("zr-")') &&
        workspaceStyles.text.match(/\.reader-panel\.code-theme-zoning \.section-block \{[\s\S]*?margin-bottom: var\(--space-2\);/) &&
        workspaceStyles.text.match(/\.reader-panel\.code-theme-zoning \.section-html > p \{[\s\S]*?margin: 0;/),
      "Zoning Reader content should suppress empty source blocks and avoid browser-default paragraph gaps."
    );
    assert(
      workspaceStyles.text.match(/\.saved-column-scroll \{[\s\S]*?overflow-y: auto;/) &&
        workspaceStyles.text.match(/\.saved-project-list \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/) &&
        workspaceStyles.text.includes("@container (min-width: 320px) {\n  .saved-project-list {\n    grid-template-columns: repeat(2, minmax(0, 1fr));") &&
        workspaceStyles.text.includes("@container (min-width: 580px) {\n  .saved-project-list {\n    grid-template-columns: repeat(3, minmax(0, 1fr));") &&
        workspaceStyles.text.match(/\.saved-code-filter \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(140px, 1fr\)\);[\s\S]*?background-image: none;/) &&
        workspaceStyles.text.match(/\.saved-project-tile \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;[\s\S]*?grid-template-rows: auto;[\s\S]*?min-height: 42px;/) &&
        workspaceStyles.text.match(/\.saved-project-count \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;/) &&
        workspaceStyles.text.match(/\.saved-projects-selection-actions \{[\s\S]*?display: flex;[\s\S]*?gap: var\(--space-1\);/) &&
        workspaceStyles.text.match(/\.saved-projects-selection-actions\[hidden\] \{[\s\S]*?display: none;/) &&
        workspaceStyles.text.match(/\.saved-projects-section\.is-selecting \.saved-projects-add-button,[\s\S]*?\.saved-projects-section\.is-selecting \.saved-projects-select-button \{[\s\S]*?display: none !important;/) &&
        workspaceStyles.text.match(/\.saved-projects-selection-action \{[\s\S]*?width: 24px;[\s\S]*?background: transparent;/) &&
        workspaceScript.text.includes("headingActions.append(selectionActions)") &&
        workspaceScript.text.includes("selectButton.hidden = selecting") &&
        !workspaceStyles.text.includes(".saved-projects-bulk-bar") &&
        !workspaceStyles.text.includes(".saved-project-tile-actions") &&
        workspaceStyles.text.includes('.saved-project-tile[data-pointer-focus="true"]:focus-visible') &&
        workspaceStyles.text.includes('.saved-project-tile[data-draggable="true"]') &&
        workspaceStyles.text.match(/\.saved-project-tile\.is-dragging \{[\s\S]*?opacity: 0\.82;/) &&
        workspaceStyles.text.includes(".saved-project-tile.is-drop-before::before") &&
        workspaceScript.text.includes("tile.draggable = true") &&
        workspaceScript.text.includes('tile.addEventListener("dragstart"') &&
        !workspaceStyles.text.includes(".saved-project-page-dots"),
      "Saved Projects should remain a vertically scrollable, reorderable width-stable card grid."
    );
    assert(
      workspaceStyles.text.includes(".custom-select-group-label") &&
        workspaceStyles.text.includes(".custom-select-option.is-indented") &&
        workspaceStyles.text.includes(".custom-select-option.is-group-action"),
      "Reader picker group headings or Construction Code indentation styles are missing."
    );
    assert(
      workspaceStyles.text.includes(".topbar .toolbar-button {\n  display: inline-flex;") &&
        workspaceStyles.text.includes("border-radius: var(--radius-pill);\n  background: color-mix(in srgb, var(--text-primary) 10%, transparent);") &&
        workspaceStyles.text.match(/\.topbar \.toolbar-button:focus-visible \{[\s\S]*?outline: 0;[\s\S]*?background: color-mix\(in srgb, var\(--text-primary\) 16%, transparent\);[\s\S]*?text-decoration: none;/) &&
        workspaceStyles.text.includes('.topbar .toolbar-button[aria-pressed="true"] {'),
      "Top toolbar controls should preserve their pill shape, ring-free focus state, and active state."
    );
    assert(
      workspaceStyles.text.match(/\.settings-destructive-secondary\.account-delete,[\s\S]*?\.settings-destructive-secondary\.settings-firm-delete \{[\s\S]*?background: color-mix\(in srgb, var\(--destructive\) 10%, transparent\);[\s\S]*?color: var\(--destructive\);/) &&
        workspaceStyles.text.includes("--destructive: #ff3b30;") &&
        workspaceStyles.text.includes("--destructive: #ff453a;"),
      "Web account and firm deletion no longer match the adaptive red iOS destructive treatment."
    );
    assert(
      workspaceScript.text.includes('deleteFirmButton.textContent = "Delete Firm Workspace"') &&
        workspaceScript.text.includes('postResearch("/organizations/delete"') &&
        workspaceScript.text.includes('confirmation: "delete"') &&
        workspaceScript.text.includes('confirmLabel: "Delete Firm"') &&
        serverSource.includes("async function handleOrganizationDelete") &&
        serverSource.includes('"organizations/delete": handleOrganizationDelete'),
      "Owners no longer have a confirmed, server-authorized Firm Workspace deletion path."
    );
    assert(
      workspaceStyles.text.match(/\.settings-scroll \{[\s\S]*?gap: calc\(var\(--space-2\) \+ var\(--space-3\)\);/),
      "Settings cards no longer use the same vertical gap as the Project card stack."
    );
    assert(
      workspaceStyles.text.match(/\.settings-panel \.settings-card,[\s\S]*?\.settings-panel \.account-connector \{[\s\S]*?border-radius: 12px;/),
      "Settings surfaces no longer use the shared 12px corner radius."
    );
    assert(
      workspaceStyles.text.match(/\.settings-panel \.settings-primary-button,[\s\S]*?\.settings-panel \.settings-mini-button \{[\s\S]*?justify-self: center;[\s\S]*?width: 60%;[\s\S]*?margin-inline: auto;[\s\S]*?border-radius: var\(--radius-pill\);/),
      "Large Settings action buttons should remain centered pills at 60% width."
    );
    assert(
      workspaceStyles.text.match(/\.settings-panel \.settings-section-title \{[\s\S]*?justify-self: center;[\s\S]*?width: 100%;[\s\S]*?text-align: center;/) &&
        workspaceStyles.text.match(/\.settings-panel \.settings-card-heading \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\);/) &&
        !workspaceStyles.text.includes(".settings-panel .settings-card-heading .settings-beta-badge"),
      "Settings card titles should remain centered without the retired beta badge."
    );
    assert(
      workspaceStyles.text.match(/\.settings-panel \.settings-card\.is-collapsed \{[\s\S]*?min-height: 56px;[\s\S]*?padding: var\(--space-3\);/) &&
        workspaceStyles.text.match(/\.settings-panel \.settings-card-toggle > span \{[\s\S]*?color: inherit;[\s\S]*?font: inherit;[\s\S]*?letter-spacing: inherit;/),
      "Collapsed Settings cards no longer share the same height, centered layout, and title typography."
    );
    assert(
      workspaceStyles.text.match(/\.research-list-panel \.analysis-content \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/) &&
        !workspaceStyles.text.includes(".research-trust-notice"),
      "The retired Research footer notice should not leave unused styling."
    );
    assert(
      workspaceStyles.text.match(/\.saved-project-tile \{[\s\S]*?border: 0;[\s\S]*?background: color-mix\(in srgb, var\(--project-color\) 42%, var\(--surface\)\);[\s\S]*?color: var\(--text-primary\);/),
      "Saved project tiles no longer use a borderless muted project tint with a contrast-safe foreground."
    );
    assert(
      workspaceStyles.text.match(/\.settings-panel \.account-plan-secondary \{[\s\S]*?justify-self: center;/),
      "Restore Purchases is no longer centered beneath the primary plan action."
    );
    assert(
      workspaceStyles.text.match(/\.account-checkout\.is-pro-active,[\s\S]*?background: var\(--pro-active-background\);[\s\S]*?color: #001014;[\s\S]*?opacity: 1;/) &&
        workspaceStyles.text.includes("--pro-active-background: #66d9f2;") &&
        workspaceStyles.text.includes("--pro-active-background: #00b9e8;") &&
        iosSettingsSource.includes("Color(red: 0, green: 185 / 255, blue: 232 / 255)") &&
        iosSettingsSource.includes(".opacity(library.isStoreKitBusy ? 0.55 : 1)") &&
        iosSettingsSource.includes("if !library.hasResearchAccess {") &&
        !iosSettingsSource.includes('return "Research Active"'),
      "Active Pro buttons no longer share the requested full-opacity cyan treatment on web and iOS."
    );
    assert(
      workspaceStyles.text.match(/\.settings-project-copy strong \{[^}]*color: var\(--project-color\);[^}]*font-weight: 400;[^}]*text-transform: none;/) &&
        !workspaceStyles.text.includes(".settings-project-swatch"),
      "Project selection rows no longer use regular-weight project-colored names without a separate color dot."
    );
    assert(
      workspaceStyles.text.includes(".annotated-code-block:hover > .inline-comment") &&
        workspaceStyles.text.match(/\.reader-content > \* \{[\s\S]*?width: 100%;[\s\S]*?max-width: 800px;/),
      "Reader passage actions or the responsive 800-pixel reading measure are missing."
    );
    assert(
      workspaceStyles.text.match(/\.annotated-code-block \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/) &&
        workspaceStyles.text.match(/\.inline-comment-toggle,[\s\S]*?\.inline-bookmark-toggle,[\s\S]*?\.inline-research-toggle \{[\s\S]*?display: inline-flex;/),
      "Reader passage actions no longer use the compact inline Save, Note, and Research row."
    );
    assert(
      workspaceStyles.text.match(/\.section-detail-heading span \{[^}]*font-weight: 400;/) &&
        workspaceStyles.text.match(/\.section-detail-heading \.section-detail-number \{[^}]*font-weight: 700;/) &&
        workspaceStyles.text.match(/\.section-detail-content \{[^}]*font-family: var\(--ui-font-family\);/) &&
        workspaceStyles.text.match(/\.section-detail-code-label \{[^}]*font-family: var\(--ui-font-family\);/) &&
        workspaceStyles.text.match(/\.section-detail-body \{[^}]*font-family: var\(--reader-font-family\);/),
      "Section Detail should preserve normal Reader text weight while emphasizing only the section number."
    );
    assert(
        workspaceScript.text.includes("openReaderNotesSheet(panel, section, reader, { target });") &&
        workspaceScript.text.includes("function renderAnnotationProjectEditor(container, target, sectionPayload") &&
        !workspaceScript.text.includes('empty.textContent = "No tags";') &&
        workspaceScript.text.includes('projectsHost.className = "section-detail-projects";') &&
        workspaceScript.text.includes('addButton.className = "annotation-project-add";') &&
        !workspaceScript.text.includes('form.className = "annotation-project-create-form";') &&
        workspaceScript.text.includes("showProjectCreateSheet(panel, null, {") &&
        workspaceScript.text.includes("onCreated: async (project)") &&
        workspaceScript.text.includes("function showProjectCreateSheet(panel, project = null, options = {})") &&
        workspaceScript.text.includes("await options.onCreated?.(createdProject);") &&
        workspaceStyles.text.match(/\.section-detail-panel \{[\s\S]*?position: relative;/) &&
        workspaceScript.text.includes("notes.append(notesHeader, textareaWrap, projectsHost, tagsHost)") &&
        workspaceScript.text.includes("function refreshOpenAnnotationProjectEditors()") &&
        !workspaceScript.text.includes('commentsLabel.textContent = "Comments";') &&
        workspaceScript.text.includes('label.textContent = "Projects";') &&
        workspaceScript.text.includes("normalizeAnnotationBlockID(candidate.blockID) === blockID") &&
        workspaceScript.text.includes("projectListToggle.textContent = projectListLabel") &&
        workspaceStyles.text.includes(".annotation-project-list-motion.is-open") &&
        workspaceStyles.text.match(/\.annotation-project-chip \+ \.annotation-project-chip \{[\s\S]*?border-top:/),
      "Reader notes or Source Detail organization no longer preserve their distinct responsibilities."
    );
    assert(
      workspaceScript.text.includes('sheet.style.setProperty("--reader-notes-input-height", `${inputHeight}px`)') &&
        workspaceScript.text.includes("const nonInputContentHeight = Math.max(0, sheet.scrollHeight - input.offsetHeight)") &&
        workspaceStyles.text.includes("--reader-notes-input-min-height: 64px;") &&
        workspaceStyles.text.includes("flex: 0 0 var(--reader-notes-input-height);"),
      "Reader note resizing no longer preserves a usable compact composer."
    );
    assert(
      workspaceStyles.text.match(/\.search-box \{[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;[\s\S]*?height: 42px;[\s\S]*?min-height: 42px;/),
      "Search field no longer spans the available column width at 42 pixels high."
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
        workspaceStyles.text.includes(".web-warning-backdrop.is-column-scoped") &&
        workspaceStyles.text.includes(".web-warning-backdrop.is-column-scoped {\n  position: fixed;") &&
        workspaceStyles.text.includes(".has-web-warning") &&
        workspaceStyles.text.includes("@container (max-width: 340px)") &&
        workspaceStyles.text.includes(".web-warning-dialog") &&
        workspaceStyles.text.includes(".web-warning-field") &&
        workspaceStyles.text.includes(".web-warning-form-error") &&
        workspaceStyles.text.includes("width: min(550px, 100%);") &&
        workspaceStyles.text.includes(".web-warning-title") &&
        workspaceStyles.text.includes("border-bottom: 1px solid var(--border);") &&
        workspaceStyles.text.includes(".web-warning-cancel") &&
        workspaceStyles.text.includes(".web-warning-confirm") &&
        workspaceStyles.text.includes("background: #df6464;") &&
        workspaceScript.text.includes("const bounds = warningContainer.getBoundingClientRect();") &&
        workspaceScript.text.includes('backdrop.style.top = `${bounds.top}px`;') &&
        workspaceScript.text.includes('backdrop.style.height = `${bounds.height}px`;') &&
        workspaceScript.text.includes("webWarningPositionCleanups.get(backdrop)?.();"),
      "Web warning-dialog proportions or action styling regressed."
    );
    assert(
      workspaceStyles.text.includes('.connection-status:not([data-state="offline"]):not([data-state="pending"]):not([data-state="conflict"])') &&
        workspaceStyles.text.match(/@media \(max-width: 760px\)[\s\S]*?\.topbar-account-state \{\s+display: contents;/) &&
        workspaceStyles.text.includes(".connection-status.is-actionable") &&
        workspaceStyles.text.includes(".connection-status.is-actionable:focus-visible"),
      "Mobile web no longer hides routine Online/Synced status while preserving exceptional sync states."
    );
    assert(
      workspaceStyles.text.includes("min-width: max(var(--pane-default-min-width), min(var(--pane-min-width), var(--pane-resized-min-width)));"),
      "Pane CSS no longer enforces the default-width floor for multi-column workspaces."
    );
    assert(
      workspaceStyles.text.match(/\.project-detail-content \{[\s\S]*?overflow-x:\s*hidden;[\s\S]*?overflow-y:\s*auto;/),
      "Project detail content can scroll horizontally."
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
        workspaceStyles.text.match(/\.saved-code-filter \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/) &&
        workspaceStyles.text.match(/\.saved-code-filter \.saved-filter-chip \{[\s\S]*?border-radius: 0;[\s\S]*?background: transparent !important;/) &&
        workspaceStyles.text.match(/\.saved-tag-filter \{[\s\S]*?grid-template-columns: repeat\(auto-fit, minmax\(140px, 1fr\)\);/) &&
        workspaceStyles.text.match(/\.saved-tag-filter-chip \{[\s\S]*?border-radius: 0;[\s\S]*?background: transparent !important;/) &&
        workspaceStyles.text.match(/\.saved-tag-filter-chip::before \{\s*content: none;/) &&
        workspaceStyles.text.includes(".saved-chapter-header") &&
        workspaceStyles.text.includes(".saved-project-tile.is-opening") &&
        workspaceStyles.text.includes(".project-detail-loading-status") &&
        workspaceStyles.text.match(/\.saved-chapter-header strong,\s*\.saved-chapter-header span \{\s*color: var\(--code-accent\);/) &&
        workspaceStyles.text.includes(".saved-inline-filters") &&
        workspaceStyles.text.match(/\.search-jump-section \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);/) &&
        workspaceStyles.text.match(/\.search-jump-tile:last-child \{[\s\S]*?border-bottom: 0;/) &&
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
      workspaceStyles.text.includes(".section-detail-tags .annotation-tag-input") &&
        workspaceStyles.text.includes(".section-detail-projects,"),
      "Section-detail organization should expose Projects before its pill-style tag input."
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
        workspaceStyles.text.includes('[style*="background-color:white" i]') &&
        workspaceStyles.text.includes(".section-html table [style*=\"background-color: white\" i]") &&
        workspaceStyles.text.includes('[style*="background-color:#C0C0C0" i]') &&
        workspaceStyles.text.includes('[style*="background-color:#808080" i]') &&
        workspaceStyles.text.includes('[style*="background-color:#f8cbad" i]') &&
        workspaceStyles.text.includes('[style*="background-color:#fbe4d5" i]'),
      "Reader tables no longer override legacy light-theme colors in dark mode."
    );
    assert(
      workspaceStyles.text.includes(".project-bulk-bar") &&
        workspaceStyles.text.includes(".project-bulk-bar.is-archive") &&
        workspaceScript.text.includes('bulkBar.classList.toggle("is-archive", mode === "archive")') &&
        workspaceScript.text.includes("bulkBar.append(actionButton, cancelButton)") &&
        workspaceScript.text.includes('mode === "archive" ? "Delete" : `Archive ${selectedCount}`') &&
        workspaceStyles.text.includes(".is-project-selecting .project-selection-check") &&
        workspaceStyles.text.includes(".project-row.is-selected"),
      "Project bulk selection omitted its compact Archive actions, selection indicators, or selected-card treatment."
    );
    assert(
      workspaceScript.text.includes("async function refreshWorkspaceAfterSettingsClear(settingsScrollTop, workspaceScrollLeft)") &&
        workspaceScript.text.includes('activePaneIDs().filter((paneID) => paneID !== "utility:settings")') &&
        workspaceScript.text.includes('track.querySelector(\'.workspace-panel[data-pane-id="utility:settings"]\')') &&
        workspaceScript.text.includes("settingsPanel.scrollTop = Math.min(") &&
        workspaceScript.text.includes("await refreshWorkspaceAfterSettingsClear(settingsScrollTop, workspaceScrollLeft)") &&
        workspaceScript.text.includes("await flushSyncOutbox({ refresh: true }).catch(() => {})"),
      "Settings clear-all actions no longer preserve the Settings column's position while refreshing affected panes."
    );
    assert(
      workspaceScript.text.includes("function wireSettingsCardCollapsing(panel)") &&
        workspaceScript.text.includes('panel.querySelectorAll(":scope > .settings-card")') &&
        workspaceScript.text.includes("collapsedSettingsCardIDs.has(cardID)") &&
        workspaceScript.text.includes('toggle.setAttribute("aria-expanded", String(!collapsed))') &&
        workspaceScript.text.includes('content.className = "settings-card-content"') &&
        workspaceScript.text.includes('card.style.setProperty("--settings-card-content-height"') &&
        workspaceScript.text.includes('content.toggleAttribute("inert", collapsed)') &&
        workspaceStyles.text.includes(".settings-panel .settings-card-toggle") &&
        !workspaceStyles.text.includes(".settings-card-toggle::after") &&
        workspaceStyles.text.match(/\.settings-panel \.settings-card-toggle \{[\s\S]*?font-size: 9pt !important;[\s\S]*?letter-spacing: 0\.085em !important;/) &&
        workspaceStyles.text.match(/\.settings-panel \.settings-card-content \{[\s\S]*?max-height: var\(--settings-card-content-height, 1200px\);[\s\S]*?overflow: hidden;[\s\S]*?max-height 420ms cubic-bezier\(0\.22, 1, 0\.36, 1\),[\s\S]*?opacity 260ms ease;/) &&
        workspaceStyles.text.match(/\.settings-panel \.settings-card\.is-collapsed > \.settings-card-content \{[\s\S]*?max-height: 0;[\s\S]*?opacity: 0;[\s\S]*?pointer-events: none;/),
      "Settings cards no longer provide independent, accessible title toggles with Saved-filter motion."
    );
    assert(
      workspaceStyles.text.includes(".saved-note-preview") &&
        workspaceStyles.text.includes(".project-saved-code-group") &&
        workspaceStyles.text.match(/\.project-detail-section-preview \{[\s\S]*?text-overflow: ellipsis;[\s\S]*?-webkit-line-clamp: 3;/) &&
        workspaceStyles.text.includes(".project-detail-section-heading") &&
        workspaceStyles.text.match(/\.project-detail-saved-row \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?border-radius: 0;/) &&
        workspaceScript.text.includes('savedSelectButton.className = "project-section-toggle-chevron project-evidence-select-button"') &&
        workspaceScript.text.includes('savedBulkBar.className = "project-bulk-bar project-evidence-bulk-bar"') &&
        workspaceScript.text.includes("await unlinkEvidenceFromFolder(identity, item, panel)") &&
        workspaceStyles.text.includes(".project-saved-evidence-body.is-selecting .project-detail-saved-row.is-selected"),
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
      webRoot.text.includes('class="reader-reading-progress"') &&
        webRoot.text.includes('class="reader-reading-progress-value"') &&
        webRoot.text.includes('class="reader-to-top"') &&
        workspaceStyles.text.match(/\.reader-reading-progress \{[\s\S]*?right: calc\(var\(--panel-padding\) \+ var\(--reader-scrollbar-rail-width\)\);[\s\S]*?left: var\(--panel-padding\);[\s\S]*?height: 3px;[\s\S]*?background: color-mix\(in srgb, var\(--code-accent\) 22%, transparent\);/) &&
        workspaceStyles.text.match(/\.reader-reading-progress-value \{[\s\S]*?transform: scaleX\(var\(--reader-reading-progress, 0\)\);[\s\S]*?transition: transform 50ms linear;/) &&
        workspaceStyles.text.match(/\.reader-to-top \{[\s\S]*?right: var\(--panel-padding\);[\s\S]*?bottom: calc\(var\(--panel-padding\) \+ var\(--space-3\)\);/) &&
        workspaceScript.text.includes("content.scrollTop / scrollable") &&
        workspaceScript.text.includes('progress?.setAttribute("aria-valuenow"') &&
        workspaceScript.text.includes('toTopButton.classList.toggle("is-visible", showToTop)') &&
        workspaceScript.text.includes('content.scrollTo({ top: 0, behavior: "smooth" })') &&
        workspaceScript.text.includes('track.addEventListener("permitext:workspace-layout-change", scheduleVisibleReaderScrollIndicatorUpdates)'),
      "Reader chapter progress or the contextual Back to top control is missing."
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
      workspaceScript.text.includes('const workboardClientVersion = "20260801-workboard-control-align-v31";') &&
        workspaceScript.text.includes('link.href = "/web/workboard-assets/workboard.css?v=20260801-workboard-control-align-v68"') &&
        workspaceScript.text.includes('link[href*="/web/workboard-assets/workboard.css"]') &&
        !webRoot.text.includes('/web/workboard-assets/workboard.css?v=20260801-workboard-control-align-v68'),
      "Workboard styles should load once, on demand, instead of blocking every workspace load."
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
        workboardSource.includes('"viewBackgroundColor",') &&
        workboardSource.includes("changeViewBackgroundColor: true") &&
        workboardSource.includes('mediaQuery.addEventListener("change", updateTheme)') &&
        workboardSource.includes("theme={theme}"),
      "Workboard no longer follows live system appearance changes."
    );
    assert(
      webRoot.text.includes('id="toggle-workboard"') &&
        webRoot.text.includes('data-deferred-feature="workboard" hidden') &&
        workspaceScript.text.includes("workboard: false") &&
        workspaceScript.text.includes('toggleWorkboardButton.style.display = releaseSurfaceVisibility.workboard ? "" : "none"') &&
        workspaceScript.text.includes("if (!releaseSurfaceVisibility.workboard && !detachedProjectWindow) return false;") &&
        workspaceScript.text.includes('id: "permitext-generic-workboard"') &&
        workspaceScript.text.includes("const syncEnabled = !isGeneric && Boolean(activeAccount())") &&
        workspaceScript.text.includes("saveSyncedBoard: isGeneric ? null : saveSyncedWorkboard") &&
        workspaceScript.text.includes("function retireProjectWorkboardSyncState()") &&
        !workspaceScript.text.includes('workboardButton.textContent = "Workboard"') &&
        !iosBookmarksSource.includes("Workboard editing stays on the web") &&
        !iosOrganizationProjectHubSource.includes("Workboard preview"),
      "Deferred Workboard must stay hidden from web and iOS while its implementation and data compatibility remain preserved."
    );
    assert(
      workspaceScript.text.includes("function placeProjectToolPaneLast(detail, paneID)") &&
        workspaceScript.text.includes("if (!wasOpen) placeProjectToolPaneLast(identity, coordinationID)") &&
        workspaceScript.text.includes("function projectForToolPaneID(paneID)") &&
        workspaceScript.text.includes("projectDetailMatches(draggedProject, targetProject)") &&
        workspaceScript.text.includes("createProjectToolDragHandle(identity)") &&
        workspaceStyles.text.includes(".workboard-panel > .project-tool-pane-drag-handle"),
      "Project tools should append in opening order and only drag within their own Project group."
    );
    assert(
      workspaceScript.text.includes("coordination: false") &&
        workspaceScript.text.includes("if (!releaseSurfaceVisibility.coordination) return false;") &&
        workspaceScript.text.includes("releaseSurfaceVisibility.coordination && projectHasOpenCoordination(detail)") &&
        iosLibraryViewModelSource.includes("static let coordination = false") &&
        iosOrganizationProjectHubSource.includes("if PermitextReleaseSurfaceVisibility.coordination {") &&
        iosBookmarksSource.includes('PermitextReleaseSurfaceVisibility.coordination || $0.cardType != "coordination-item"'),
      "Deferred Coordination must stay hidden and blocked on web and iOS while its implementation remains preserved."
    );
    assert(
      workboardSource.includes("const preventWheelPanning = (event) =>") &&
        workboardSource.includes("if (event.ctrlKey || event.metaKey) return;") &&
        workboardSource.includes("event.stopImmediatePropagation();") &&
        workboardSource.includes('host.addEventListener("wheel", preventWheelPanning, { capture: true, passive: false })'),
      "Workboard wheel panning guard no longer preserves trackpad and modified-wheel zoom gestures."
    );
    assert(
        !workboardSource.includes("permitext-workboard-zoom-controls") &&
        !workboardSource.includes('aria-label="Reset zoom"') &&
        !workboardSource.includes("New local board") &&
        workboardSource.includes('status === "Synced" || status === "Saved locally" ? "" : status') &&
        workboardSource.includes('visibleStatus ? <span className="permitext-workboard-save-state"') &&
        workboardStyleSource.includes("width: var(--panel-title-control-size, 18px);") &&
        workboardStyleSource.includes("color: var(--text-secondary, #8f8f96);") &&
        workboardStyleSource.includes("width: var(--panel-title-icon-size, 16px);") &&
        workboardStyleSource.includes(".permitext-workboard .help-icon {\n  display: none !important;"),
      "Workboard header controls no longer match the shared workspace icon metrics."
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
    assert(
      workboardStyleSource.includes("--project-pane-band-background") &&
        workboardStyleSource.includes("color-mix(in srgb, var(--project-color, #c96410) 42%, var(--surface, #fff))") &&
        workboardStyleSource.includes("top: var(--panel-padding, 24px);") &&
        workboardStyleSource.includes("right: 16px;") &&
        workboardStyleSource.match(/background: var\(--surface-raised, #fff\);/g)?.length >= 2,
      "Workboard no longer limits the owning Project color to its aligned header band."
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
    const plumbingFixtureTable = await request("/code/sections/11909");
    assert(plumbingFixtureTable.response.ok, "Plumbing Code section 403.1 did not load.");
    assert(
      plumbingFixtureTable.json.section.codePrefix === "PC" &&
        plumbingFixtureTable.json.section.sectionNumber === "403.1" &&
        plumbingFixtureTable.json.section.blocks.some((block) =>
          /<ScrollTable\b/i.test(block.html || "") &&
          /<table\b/i.test(block.html || "") &&
          String(block.plainText || "").includes("Minimum Number of Required Plumbing Fixtures")
        ),
      "PC 403.1 flattened Table 403.1 instead of serving the complete official table source."
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
    const administrativeChapter4Window = await request(
      "/code/chapters/77?include=body&bodyStart=1&bodyLimit=1"
    );
    assert(
      administrativeChapter4Window.response.ok &&
        administrativeChapter4Window.json.chapter.bodyRange?.start === 1 &&
        administrativeChapter4Window.json.chapter.bodyRange?.end === 2 &&
        administrativeChapter4Window.json.chapter.bodyRange?.complete === false &&
        administrativeChapter4Window.json.chapter.sections.filter((section) =>
          Array.isArray(section.blocks)
        ).length === 1,
      "Windowed chapter loading returned the wrong body range."
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
    const firstSearchPage = await request("/code/search?q=egress&code=BC&limit=2&offset=0");
    const secondSearchPage = await request("/code/search?q=egress&code=BC&limit=2&offset=2");
    assert(
      firstSearchPage.response.ok &&
        secondSearchPage.response.ok &&
        firstSearchPage.json.results.length === 2 &&
        secondSearchPage.json.results.length === 2 &&
        firstSearchPage.json.totalResults > 4 &&
        firstSearchPage.json.offset === 0 &&
        firstSearchPage.json.nextOffset === 2 &&
        firstSearchPage.json.hasMore === true &&
        secondSearchPage.json.offset === 2 &&
        secondSearchPage.json.results[0].id !== firstSearchPage.json.results[0].id,
      "Search pagination did not return stable, non-overlapping result pages."
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
    const trustProfiles = codeLibraries.json.codeTrustProfiles || [];
    const trustProfilesByPrefix = new Map(
      trustProfiles.map((profile) => [profile.codePrefix, profile])
    );
    assert(
      trustProfiles.length === 17 && trustProfilesByPrefix.size === 17,
      "Code-library metadata did not return one normalized trust profile per supported code."
    );
    assert(
      trustProfilesByPrefix.get("BC")?.statusKind === "enacted-edition" &&
        trustProfilesByPrefix.get("BC")?.effectiveDate === "2022-11-07" &&
        trustProfilesByPrefix.get("EC")?.statusKind === "amendments-only" &&
        /NFPA 70 text is not reproduced/i.test(trustProfilesByPrefix.get("EC")?.boundary || "") &&
        trustProfilesByPrefix.get("EBC")?.statusKind === "future-effective" &&
        trustProfilesByPrefix.get("EBC")?.effectiveDate === "2027-07-17" &&
        trustProfilesByPrefix.get("BC68")?.statusKind === "historical" &&
        trustProfilesByPrefix.get("ZR")?.statusKind === "continuously-amended" &&
        /2026-07-16/.test(trustProfilesByPrefix.get("ZR")?.currentThrough || ""),
      "Normalized trust metadata lost a material legal status distinction."
    );
    const zoningLibrary = codeLibraries.json.libraries.find((library) => library.id === "nyc-zoning-resolution");
    assert(zoningLibrary, "Code-library metadata omitted the Zoning Resolution.");
    assert(zoningLibrary.syncCodeVersion === zoningSyncCodeVersion, "Zoning library returned the wrong sync identity.");
    assert(zoningLibrary.textChangesThrough === "2026-07-16", "Zoning library returned the wrong source cutoff.");
    assert(zoningLibrary.researchEligibility === false, "Zoning Research was enabled before its approval gate.");
    const existingBuildingLibrary = codeLibraries.json.libraries.find(
      (library) => library.id === "nyc-existing-building-code"
    );
    assert(existingBuildingLibrary, "Code-library metadata omitted the Existing Building Code.");
    assert(
      existingBuildingLibrary.syncCodeVersion === existingBuildingSyncCodeVersion,
      "Existing Building Code returned the wrong sync identity."
    );
    assert(
      existingBuildingLibrary.effectiveDate === "2027-07-17" &&
        existingBuildingLibrary.effectiveStatus === "enacted-not-yet-effective",
      "Existing Building Code omitted its future effective status."
    );

    const existingBuildingChapters = await request("/code/chapters?code=EBC");
    assert(existingBuildingChapters.response.ok, "Existing Building Code chapter index did not load.");
    assert(
      existingBuildingChapters.json.chapters.length === 31 &&
        existingBuildingChapters.json.chapters.every((chapter) => chapter.codePrefix === "EBC"),
      "Existing Building Code chapter index was incomplete."
    );
    const existingBuildingSection = await request("/code/sections/26000000");
    assert(existingBuildingSection.response.ok, "Existing Building Code section 101 did not load.");
    assert(
      existingBuildingSection.json.section.sectionNumber === "101" &&
        existingBuildingSection.json.section.codeVersion === existingBuildingSyncCodeVersion &&
        existingBuildingSection.json.section.existingBuildingCode.effectiveStatus ===
          "enacted-not-yet-effective",
      "Existing Building Code section 101 lost its source or effective-date identity."
    );
    const existingBuildingSearch = await request(
      "/code/search?q=repair%20alteration%20occupancy&code=EBC&limit=20"
    );
    assert(
      existingBuildingSearch.response.ok &&
        existingBuildingSearch.json.results.some((result) => result.id === 26_000_000),
      "Existing Building Code search did not return section 101."
    );

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

    const fireChapters = await request("/code/chapters?code=FC");
    assert(fireChapters.response.ok, "Fire Code chapter index did not load.");
    assert(
      fireChapters.json.chapters.length === 50 &&
        fireChapters.json.chapters.every((chapter) => chapter.codePrefix === "FC"),
      "Fire Code did not expose its logical navigation chapters."
    );
    const fireAdministration = fireChapters.json.chapters.find((chapter) =>
      chapter.fullTitle === "Chapter 1: Administration"
    );
    assert(fireAdministration, "Fire Code omitted Chapter 1: Administration.");
    const fireAdministrationDetail = await request(`/code/chapters/${fireAdministration.id}`);
    assert(fireAdministrationDetail.response.ok, "Fire Code Administration chapter did not load.");
    const fireAdministrationNumbers = (fireAdministrationDetail.json.chapter.sections || []).map((section) =>
      section.sectionNumber
    );
    assert(
      ["FC 101", "FC 102", "FC 103", "FC 104"].every((number) => fireAdministrationNumbers.includes(number)),
      "Fire Code Administration omitted FC 101-104."
    );
    const fireReserved = await request("/code/sections/31004665");
    assert(fireReserved.response.ok, "FC 103 did not load.");
    assert(
      fireReserved.json.section.id === 31_004_665 &&
        fireReserved.json.section.sectionNumber === "FC 103" &&
        fireReserved.json.section.navigationChapterID === fireAdministration.id,
      "FC 103 lost its canonical ID, visible number, or navigation chapter."
    );
    const fuelGasChapters = await request("/code/chapters?code=FGC");
    assert(fuelGasChapters.response.ok, "Fuel Gas Code chapter index did not load.");
    assert(
      fuelGasChapters.json.chapters.length === 15 &&
        fuelGasChapters.json.chapters.every((chapter) => chapter.codePrefix === "FGC"),
      "Fuel Gas Code chapter count changed."
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

    const wrongAdminStorageSummary = await request("/admin/storage/summary", {
      token: `${adminToken.slice(0, -1)}x`
    });
    assert(
      wrongAdminStorageSummary.response.status === 401,
      "Storage summary accepted a same-length mismatched administrator credential."
    );

    const grantAdminStorageSummary = await request("/admin/storage/summary", {
      token: grantAdminToken
    });
    assert(
      grantAdminStorageSummary.response.status === 401,
      "Storage summary accepted the grant-only administrator credential."
    );

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

    const rotationCredential = {
      provider: "apple",
      providerUserID: "smoke-session-rotation-user",
      displayName: "Session Rotation Smoke User"
    };
    const firstRotationSignIn = await request("/account/sign-in", {
      method: "POST",
      body: { credential: rotationCredential }
    });
    const secondRotationSignIn = await request("/account/sign-in", {
      method: "POST",
      body: { credential: rotationCredential }
    });
    assert(
      firstRotationSignIn.response.ok &&
        secondRotationSignIn.response.ok &&
        firstRotationSignIn.json.account.backendSessionToken !==
          secondRotationSignIn.json.account.backendSessionToken,
      "File-store sign-in did not rotate the backend session token."
    );
    const rotationUserID = secondRotationSignIn.json.account.appUserID;
    const pullWithOldRotationToken = await request("/sync/pull", {
      method: "POST",
      token: firstRotationSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: rotationUserID },
        syncSchemaVersion: 2
      }
    });
    assert(
      pullWithOldRotationToken.response.status === 401,
      "The previous backend session remained valid after re-login."
    );
    const pullWithNewRotationToken = await request("/sync/pull", {
      method: "POST",
      token: secondRotationSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: rotationUserID },
        syncSchemaVersion: 2
      }
    });
    assert(
      pullWithNewRotationToken.response.ok,
      "The rotated backend session was not accepted."
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
        scissorEvidenceDiscovery.json.schemaVersion === 2 &&
        scissorEvidenceDiscovery.json.generatedAnswer === false &&
        scissorEvidenceDiscovery.json.paidModelCall === false &&
        scissorEvidenceDiscovery.json.candidates.length > 0 &&
        scissorEvidenceDiscovery.json.candidates.every((candidate) =>
          candidate.candidateState === "candidate" &&
          candidate.selectedText &&
          typeof candidate.preparationEligible === "boolean" &&
          Array.isArray(candidate.sourceReviewRequirements) &&
          !candidate.approved
        ) &&
        scissorEvidenceDiscovery.json.candidates.some((candidate) =>
          candidate.sectionID === "2197" &&
          candidate.codePrefix === "BC" &&
          candidate.sectionNumber === "1007.1.1"
        ),
      "Find Relevant Evidence did not return unapproved canonical scissor-stair candidates without generating an answer."
    );
    const plumbingTableDiscovery = await request("/research/evidence/discover", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "For an accessory assembly room, what minimum fixtures does PC 403.1 and Table 403.1 require?",
        limit: 12
      }
    });
    const plumbingTableCandidate = plumbingTableDiscovery.json.candidates?.find((candidate) =>
      candidate.sectionID === "11909"
    );
    assert(
      plumbingTableDiscovery.response.ok &&
        plumbingTableCandidate?.preparationEligible === true &&
        plumbingTableCandidate?.richSourceIDs?.length === 1 &&
        plumbingTableCandidate?.richSources?.some((source) =>
          source.kind === "table" &&
          source.reference === "PC Table 403.1" &&
          source.contentHash &&
          source.rowCount > 0
        ) &&
        plumbingTableCandidate?.sourceReviewRequirements?.length === 0,
      "Evidence discovery did not attach the complete structured PC Table 403.1 source."
    );
    const invalidStructuredEvidence = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: plumbingTableCandidate.sectionID,
        selectedText: plumbingTableCandidate.selectedText,
        richSourceIDs: ["rich-source-client-forgery"]
      }
    });
    assert(
      invalidStructuredEvidence.response.status === 400,
      "Research accepted a structured evidence ID that was not derived from the current enacted source."
    );
    const structuredTableConversation = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: plumbingTableCandidate.sectionID,
        selectedText: plumbingTableCandidate.selectedText,
        richSourceIDs: plumbingTableCandidate.richSourceIDs
      }
    });
    const structuredTableSelections = structuredTableConversation.json.conversation?.sources
      ?.filter((source) => source.kind === "selection") || [];
    assert(
      structuredTableConversation.response.status === 201 &&
        structuredTableSelections.length === 2 &&
        structuredTableSelections.some((source) =>
          source.richSourceKind === "table" &&
          source.richSourceReference === "PC Table 403.1" &&
          source.richSourceContentHash === plumbingTableCandidate.richSources[0].contentHash &&
          source.richSourceRowCount === plumbingTableCandidate.richSources[0].rowCount &&
          source.richSourceGrids?.some((grid) =>
            grid.rows?.some((row) =>
              row.cells?.some((cell) => cell.rowSpan > 1 || cell.columnSpan > 1)
            )
          ) &&
          source.selectedText.includes("Minimum Number of Required Plumbing Fixtures")
        ),
      "Preparing a table-dependent candidate did not preserve the separately approved structured source."
    );
    const structuredTableMessage = await request("/research/conversations/message", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID: structuredTableConversation.json.conversation.id,
        question: "Which structured table evidence governs the minimum fixture count?"
      }
    });
    const structuredTableAnswerID = structuredTableMessage.json?.conversation?.messages?.find(
      (message) => message.role === "assistant"
    )?.id;
    const structuredTableAnswer = await request("/research/answers/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        answerID: structuredTableAnswerID
      }
    });
    assert(
      structuredTableMessage.response.ok &&
        structuredTableAnswer.response.ok &&
        structuredTableAnswer.json.answer.evidence.some((snapshot) =>
          snapshot.structuredSource?.reference === "PC Table 403.1" &&
          snapshot.structuredSource.contentHash === plumbingTableCandidate.richSources[0].contentHash &&
          snapshot.structuredSource.rowCount === plumbingTableCandidate.richSources[0].rowCount &&
          snapshot.structuredSource.grids.some((grid) =>
            grid.rows.some((row) =>
              row.cells.some((cell) => cell.rowSpan > 1 || cell.columnSpan > 1)
            )
          )
        ),
      "The immutable Research answer did not retain the approved table grid and integrity identity."
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
          item.label === "HCR requirements" &&
          item.sourceURL === "https://hcr.ny.gov/"
        ),
      "Evidence discovery did not disclose missing section context and outside-agency authority."
    );
    const fireDistrictMapDiscovery = await request("/research/evidence/discover", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "Can BC D106.1 and AC 28-102.4.5 prove that this Queens lot is inside the fire district?",
        limit: 12
      }
    });
    const fireDistrictMapCandidate = fireDistrictMapDiscovery.json.candidates?.find((candidate) =>
      candidate.sectionID === "6881"
    );
    assert(
      fireDistrictMapDiscovery.response.ok &&
        fireDistrictMapCandidate?.preparationEligible === false &&
        fireDistrictMapCandidate?.sourceReviewRequirements?.some((item) =>
          item.kind === "visual-source" &&
          item.count === 41 &&
          item.reviewMode === "explicit-selection" &&
          item.maximumSelections === 4
        ) &&
        fireDistrictMapCandidate?.visualSources?.length === 41 &&
        fireDistrictMapCandidate?.visualSourceIDs?.length === 41 &&
        fireDistrictMapCandidate.visualSources.every((source) =>
          source.kind === "image" &&
          /^\/code\/assets\/[a-zA-Z0-9._-]+$/.test(source.assetURL || "") &&
          /^[a-f0-9]{64}$/.test(source.contentHash || "") &&
          source.byteLength > 0
        ) &&
        fireDistrictMapDiscovery.json.coverageLimitations.some((item) =>
          item.kind === "visual-source-review-required"
        ),
      "Evidence discovery allowed a text-only fire-district determination without its 41 official map images."
    );
    const fireDistrictMapAsset = await request(fireDistrictMapCandidate.visualSources[0].assetURL);
    assert(
      fireDistrictMapAsset.response.ok &&
        fireDistrictMapAsset.response.headers.get("content-type")?.startsWith("image/"),
      "The integrity-addressed fire-district visual inventory referenced an unavailable official asset."
    );
    const unreviewedVisualConversation = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: fireDistrictMapCandidate.sectionID,
        selectedText: fireDistrictMapCandidate.selectedText
      }
    });
    assert(
      unreviewedVisualConversation.response.status === 400 &&
        /review and explicitly select/i.test(unreviewedVisualConversation.json.error || ""),
      "Research accepted a map-dependent passage without explicit visual-source review."
    );
    const forgedVisualConversation = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: fireDistrictMapCandidate.sectionID,
        selectedText: fireDistrictMapCandidate.selectedText,
        visualSourceIDs: ["visual-source-client-forgery"],
        visualReviewConfirmed: true
      }
    });
    assert(
      forgedVisualConversation.response.status === 400,
      "Research accepted a visual-source ID that was not derived from the current enacted source."
    );
    const selectedMapSource = fireDistrictMapCandidate.visualSources[0];
    const visualConversation = await request("/research/conversations/create", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        sectionID: fireDistrictMapCandidate.sectionID,
        selectedText: fireDistrictMapCandidate.selectedText,
        visualSourceIDs: [selectedMapSource.id],
        visualReviewConfirmed: true
      }
    });
    const visualSelection = visualConversation.json.conversation?.sources?.find((source) =>
      source.kind === "selection"
    );
    const storedVisualSource = visualSelection?.visualSources?.[0];
    assert(
      visualConversation.response.status === 201 &&
        storedVisualSource?.id === selectedMapSource.id &&
        storedVisualSource.contentHash === selectedMapSource.contentHash &&
        storedVisualSource.byteLength === selectedMapSource.byteLength &&
        Buffer.from(storedVisualSource.dataBase64, "base64").length === selectedMapSource.byteLength &&
        createHash("sha256")
          .update(Buffer.from(storedVisualSource.dataBase64, "base64"))
          .digest("hex") === selectedMapSource.contentHash &&
        visualSelection.visualReviewConfirmedAt,
      "Preparing reviewed map evidence did not preserve the exact selected image bytes and review timestamp."
    );
    const visualMessage = await request("/research/conversations/message", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID: visualConversation.json.conversation.id,
        question: "What does the selected official map establish, and what remains uncertain?"
      }
    });
    const visualAnswerID = visualMessage.json?.conversation?.messages?.find(
      (message) => message.role === "assistant"
    )?.id;
    const visualAnswer = await request("/research/answers/get", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        answerID: visualAnswerID
      }
    });
    assert(
      visualMessage.response.ok &&
        visualAnswer.response.ok &&
        visualAnswer.json.answer.evidence.some((snapshot) =>
          snapshot.visualSources?.some((source) =>
            source.id === selectedMapSource.id &&
            source.contentHash === selectedMapSource.contentHash &&
            Buffer.from(source.dataBase64, "base64").length === selectedMapSource.byteLength
          )
        ),
      "The immutable Research answer did not retain the approved official visual evidence."
    );
    const buildingsBulletinDiscovery = await request("/research/evidence/discover", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        question: "Does AC 28-210.1 prove that Buildings Bulletin 2011-010, zoning, and the Housing Maintenance Code permit a three-fixture bathroom in this cellar?",
        limit: 12
      }
    });
    assert(
      buildingsBulletinDiscovery.response.ok &&
        buildingsBulletinDiscovery.json.candidates.some((candidate) =>
          candidate.sectionID === "9361" &&
          candidate.sectionNumber === "28-210.1"
        ) &&
        ["NYC Buildings Bulletins", "NYC Zoning Resolution Research", "NYC Housing Maintenance Code"].every((label) =>
          buildingsBulletinDiscovery.json.outsideCurrentLibrary.some((item) =>
            item.label === label && /^https:\/\/.+/.test(item.sourceURL || "")
          )
        ),
      "Evidence discovery blurred the boundary between Construction Code candidates and outside Bulletin, Zoning, or Housing Maintenance authority."
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
      /^[A-Z][a-z]{2} \d{1,2}, \d{4} · \d{1,2}:\d{2} [AP]M$/.test(createdConversation.json.conversation.title),
      "New Research conversations should use their New York creation date and time as the default title."
    );
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

    const conversationMessage = await requestNDJSON("/research/conversations/message", {
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        question: "When must the owner notify the department?",
        progressStream: "ndjson"
      }
    });
    assert(conversationMessage.response.ok, "Research conversation message failed in mock mode.");
    const publicProgress = conversationMessage.events
      .filter((event) => event.type === "progress")
      .map((event) => event.progress);
    assert(
      publicProgress.length === 12 &&
        publicProgress.every((event, index) => event.sequence === index + 1) &&
        publicProgress.every((event) => Object.keys(event).sort().join(",") === "at,label,sequence,stage,state,version"),
      "Streamed Research progress was missing, unordered, or exposed fields outside the public contract."
    );
    assert(conversationMessage.json.usage.mockMode === true, "Mock research did not disclose its zero-call mode.");
    assert(
      conversationMessage.json.conversation.messages.length === 2 &&
        conversationMessage.json.conversation.messages[1].answer.supportedPoints.length >= 1 &&
        conversationMessage.json.conversation.messages[1].answer.promptVersion.endsWith(":conversational-v2") &&
        conversationMessage.json.conversation.messages[1].answer.conclusion.startsWith("The assembled enacted provisions provide a conditional answer") &&
        conversationMessage.json.conversation.messages[1].answer.supportedPoints[0].sourceIDs[0] ===
          conversationMessage.json.conversation.messages[1].answer.citations[0].sourceIDs[0] &&
        conversationMessage.json.conversation.messages[1].answer.citations.some((citation) =>
          citation.sectionID === "8881"
        ) &&
        conversationMessage.json.conversation.messages[1].answer.evidenceSourceIDs.length >= 1 &&
        conversationMessage.json.conversation.messages[1].answer.sourceSummary.userPinnedCount >= 1 &&
        conversationMessage.json.conversation.messages[1].researchProgress.status === "completed",
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
          answer.id === answerID && answer.evidenceCount >= 1
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
        immutableAnswerRead.json.answer.evidence.some((snapshot) =>
          snapshot.sectionID === "8881" &&
          snapshot.provenance?.userSelectedText === selectedResearchText
        ) &&
        immutableAnswerRead.json.answer.passageToCitationMapping.some((mapping) =>
          mapping.evidenceSnapshotIDs.length >= 1
        ),
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
          workboardPreviewUpload.json.preview.contentHash &&
        projectFoundationWithPreview.json.researchAnswers.some((answer) =>
          answer.id === answerID && answer.sectionIDs.includes("8881")
        ) &&
        projectFoundationWithPreview.json.researchConversations.some((conversation) =>
          conversation.id === conversationID && conversation.sourceSectionIDs.includes("8881")
        ),
      "The Project foundation response omitted its Workboard preview or exact Research-to-section lineage."
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
    const viewerAcceptanceAttempts = await Promise.all(
      Array.from({ length: 2 }, () => request("/organizations/invitations/accept", {
        method: "POST",
        token: sharedViewerToken,
        body: {
          auth: { accountUserID: sharedViewerID },
          invitationToken: inviteViewer.json.invitationToken
        }
      }))
    );
    const acceptViewer = viewerAcceptanceAttempts.find(({ response }) => response.ok);
    const rejectedViewerReuse = viewerAcceptanceAttempts.find(({ json }) =>
      json?.code === "ORGANIZATION_INVITATION_UNAVAILABLE"
    );
    assert(
      acceptViewer &&
        rejectedViewerReuse &&
        acceptViewer.json.organization.role === "viewer" &&
        acceptViewer.json.organization.accessScope === "project",
      "Project invitation acceptance was not atomic or allowed token reuse."
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
    const duplicateSeatAttempts = await Promise.all(
      Array.from({ length: 2 }, () => request("/organizations/members/invite", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          email: "pending-seat-duplicate@smoke.test",
          role: "viewer"
        }
      }))
    );
    const reservedDuplicateSeat = duplicateSeatAttempts.find(({ response }) =>
      response.status === 201
    );
    const rejectedDuplicateSeat = duplicateSeatAttempts.find(({ json }) =>
      json?.code === "ORGANIZATION_INVITATION_EXISTS"
    );
    assert(
      reservedDuplicateSeat && rejectedDuplicateSeat,
      "Concurrent duplicate firm invitations did not reserve exactly one seat."
    );
    pendingSeatInvitationIDs.push(reservedDuplicateSeat.json.invitation.id);
    const concurrentSeatAttempts = await Promise.all(
      Array.from({ length: 3 }, (_, index) => request("/organizations/members/invite", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          email: `pending-seat-${index + 1}@smoke.test`,
          role: "viewer"
        }
      }))
    );
    const reservedConcurrentSeats = concurrentSeatAttempts.filter(({ response }) =>
      response.status === 201
    );
    const rejectedConcurrentSeats = concurrentSeatAttempts.filter(({ json }) =>
      json?.code === "ORGANIZATION_SEAT_LIMIT"
    );
    assert(
      reservedConcurrentSeats.length === 2 &&
        rejectedConcurrentSeats.length === 1 &&
        rejectedConcurrentSeats[0].json.seats.used === 5,
      "Concurrent firm invitations exceeded the seat limit."
    );
    pendingSeatInvitationIDs.push(
      ...reservedConcurrentSeats.map(({ json }) => json.invitation.id)
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
    const invitationRaceSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-invitation-race",
          email: "invitation-race@smoke.test",
          displayName: "Invitation Race"
        }
      }
    });
    const invitationRaceUserID = invitationRaceSignIn.json.account.appUserID;
    const invitationRaceToken = invitationRaceSignIn.json.account.backendSessionToken;
    const invitationRaceSetup = await request("/organizations/members/invite", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        email: "invitation-race@smoke.test",
        role: "viewer"
      }
    });
    assert(invitationRaceSetup.response.status === 201, "Invitation race setup failed.");
    const [racedAcceptance, racedRevocation] = await Promise.all([
      request("/organizations/invitations/accept", {
        method: "POST",
        token: invitationRaceToken,
        body: {
          auth: { accountUserID: invitationRaceUserID },
          invitationToken: invitationRaceSetup.json.invitationToken
        }
      }),
      request("/organizations/invitations/revoke", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          invitationID: invitationRaceSetup.json.invitation.id
        }
      })
    ]);
    assert(
      Number(racedAcceptance.response.ok) + Number(racedRevocation.response.ok) === 1 &&
        [racedAcceptance.json.code, racedRevocation.json.code]
          .filter(Boolean)
          .includes("ORGANIZATION_INVITATION_UNAVAILABLE"),
      "Concurrent invitation acceptance and revocation did not produce one terminal outcome."
    );
    const invitationRaceDirectory = await request("/organizations/members/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID
      }
    });
    const invitationRaceMembership = invitationRaceDirectory.json.members.find((member) =>
      member.userID === invitationRaceUserID
    );
    const invitationRaceRecord = invitationRaceDirectory.json.invitations.find((candidate) =>
      candidate.id === invitationRaceSetup.json.invitation.id
    );
    assert(
      racedAcceptance.response.ok
        ? invitationRaceMembership?.status === "active" &&
          invitationRaceRecord?.status === "accepted"
        : !invitationRaceMembership && invitationRaceRecord?.status === "revoked",
      "Invitation acceptance/revocation race left membership and invitation state inconsistent."
    );
    if (invitationRaceMembership?.status === "active") {
      const deactivateInvitationRaceMember = await request("/organizations/members/update", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          userID: invitationRaceUserID,
          status: "deactivated"
        }
      });
      assert(
        deactivateInvitationRaceMember.response.ok,
        "Accepted invitation race member cleanup failed."
      );
    }
    const reactivationRaceSignIn = await request("/account/sign-in", {
      method: "POST",
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-reactivation-race",
          email: "reactivation-race@smoke.test",
          displayName: "Reactivation Race"
        }
      }
    });
    const reactivationRaceUserID = reactivationRaceSignIn.json.account.appUserID;
    const reactivationRaceSetup = await request("/organizations/members/invite", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        email: "reactivation-race@smoke.test",
        role: "viewer"
      }
    });
    assert(reactivationRaceSetup.response.status === 201, "Reactivation race setup failed.");
    const acceptReactivationRaceMember = await request("/organizations/invitations/accept", {
      method: "POST",
      token: reactivationRaceSignIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: reactivationRaceUserID },
        invitationToken: reactivationRaceSetup.json.invitationToken
      }
    });
    assert(acceptReactivationRaceMember.response.ok, "Reactivation race member setup failed.");
    const deactivateReactivationRaceMember = await request("/organizations/members/update", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        userID: reactivationRaceUserID,
        status: "deactivated"
      }
    });
    assert(deactivateReactivationRaceMember.response.ok, "Reactivation race reset failed.");
    const [racedReactivation, racedFinalSeatInvitation] = await Promise.all([
      request("/organizations/members/update", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          userID: reactivationRaceUserID,
          status: "active"
        }
      }),
      request("/organizations/members/invite", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          email: "reactivation-final-seat@smoke.test",
          role: "viewer"
        }
      })
    ]);
    assert(
      Number(racedReactivation.response.ok) + Number(racedFinalSeatInvitation.response.ok) === 1 &&
        [racedReactivation.json.code, racedFinalSeatInvitation.json.code]
          .filter(Boolean)
          .includes("ORGANIZATION_SEAT_LIMIT"),
      "A concurrent reactivation and invitation both consumed the final firm seat."
    );
    if (racedReactivation.response.ok) {
      const releaseReactivatedSeat = await request("/organizations/members/update", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          userID: reactivationRaceUserID,
          status: "deactivated"
        }
      });
      assert(releaseReactivatedSeat.response.ok, "Reactivated seat cleanup failed.");
    } else {
      const releaseRacedInvitation = await request("/organizations/invitations/revoke", {
        method: "POST",
        token: signIn.json.account.backendSessionToken,
        body: {
          auth: { accountUserID: userID },
          organizationID,
          invitationID: racedFinalSeatInvitation.json.invitation.id
        }
      });
      assert(releaseRacedInvitation.response.ok, "Raced invitation cleanup failed.");
    }
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
        linkedItemSnapshot: {
          label: "Client supplied labels must not become historical evidence."
        },
        title: "Confirm the Project occupancy group",
        body: "The professional record needs this fact before the Research conclusion is relied upon."
      }
    });
    assert(
      reviewerMissingFactRequest.response.status === 201 &&
        reviewerMissingFactRequest.json.thread.createdByUserID === sharedReviewerID &&
        reviewerMissingFactRequest.json.thread.createdByDisplayName === "Smoke Reviewer" &&
        reviewerMissingFactRequest.json.thread.targetID === answerID &&
        reviewerMissingFactRequest.json.thread.linkedItemSnapshot?.label !==
          "Client supplied labels must not become historical evidence." &&
        reviewerMissingFactRequest.json.activity.action === "review-thread.created",
      `A Project reviewer could not open an attributed missing-information request: ${reviewerMissingFactRequest.response.status} ${JSON.stringify(reviewerMissingFactRequest.json)}`
    );
    const reviewThreadID = reviewerMissingFactRequest.json.thread.id;
    const invalidReviewAssignee = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 1,
        assigneeUserID: "not-a-project-member"
      }
    });
    assert(
      invalidReviewAssignee.response.status === 400 &&
        invalidReviewAssignee.json.code === "INVALID_REVIEW_ASSIGNEE",
      "A coordination thread accepted an assignee without active Project access."
    );
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
    const reviewerWaitingAssignment = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 1,
        status: "waiting",
        assigneeUserID: sharedEditorID
      }
    });
    assert(
      reviewerWaitingAssignment.response.ok &&
        reviewerWaitingAssignment.json.thread.version === 2 &&
        reviewerWaitingAssignment.json.thread.status === "waiting" &&
        reviewerWaitingAssignment.json.thread.assigneeUserID === sharedEditorID &&
        reviewerWaitingAssignment.json.thread.resolvedAt === null &&
        reviewerWaitingAssignment.json.activities.some((activity) =>
          activity.action === "review-thread.status.changed" &&
          activity.metadata.threadID === reviewThreadID
        ) &&
        reviewerWaitingAssignment.json.activities.some((activity) =>
          activity.action === "review-thread.assignee.changed" &&
          activity.metadata.newAssigneeUserID === sharedEditorID
        ),
      "A reviewer could not mark coordination as waiting and assign an active Project member."
    );
    const deactivateHistoricalAssignee = await request("/organizations/members/update", {
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
    assert(
      deactivateHistoricalAssignee.response.ok &&
        deactivateHistoricalAssignee.json.membership.status === "deactivated",
      "The historical Coordination assignee could not be deactivated for compatibility testing."
    );
    const editWithInactiveHistoricalAssignee = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 2,
        body: "The professional record still needs this fact before the Research conclusion is relied upon."
      }
    });
    assert(
      editWithInactiveHistoricalAssignee.response.ok &&
        editWithInactiveHistoricalAssignee.json.thread.version === 3 &&
        editWithInactiveHistoricalAssignee.json.thread.assigneeUserID === sharedEditorID,
      "An unchanged historical assignee blocked a later Coordination edit after deactivation."
    );
    const reactivateHistoricalAssignee = await request("/organizations/members/update", {
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
      reactivateHistoricalAssignee.response.ok &&
        reactivateHistoricalAssignee.json.membership.status === "active",
      "The historical Coordination assignee could not be restored for response testing."
    );
    const editorReassignment = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 3,
        assigneeUserID: sharedReviewerID
      }
    });
    assert(
      editorReassignment.response.ok &&
        editorReassignment.json.thread.version === 4 &&
        editorReassignment.json.thread.assigneeUserID === sharedReviewerID &&
        editorReassignment.json.activity.action === "review-thread.assignee.changed",
      "An editor with response permission could not reassign a coordination thread."
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
    const responseUpdateSnapshot = await request("/organizations/projects/snapshot", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0]
      }
    });
    const responseUpdatedThread = (responseUpdateSnapshot.json.project?.artifacts || [])
      .find((artifact) =>
        artifact.envelope?.type === "reviewThread" && artifact.envelope.id === reviewThreadID
      );
    assert(
      responseUpdateSnapshot.response.ok &&
        responseUpdatedThread?.envelope.updatedAt === editorReviewResponse.json.comment.createdAt,
      "A Coordination response did not advance the thread's displayed latest update."
    );
    const reviewerResolutionWithoutStatement = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 4,
        status: "resolved"
      }
    });
    assert(
      reviewerResolutionWithoutStatement.response.status === 400 &&
        reviewerResolutionWithoutStatement.json.code === "INVALID_REVIEW_THREAD" &&
        /resolution statement/i.test(reviewerResolutionWithoutStatement.json.error),
      "A coordination thread was resolved without a concise resolution statement."
    );
    const reviewerResolution = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 4,
        status: "resolved",
        resolution: "Occupancy group B was confirmed from the approved Project drawings."
      }
    });
    assert(
      reviewerResolution.response.ok &&
        reviewerResolution.json.thread.status === "resolved" &&
        reviewerResolution.json.thread.resolvedByUserID === sharedReviewerID &&
        reviewerResolution.json.thread.resolvedByDisplayName === "Smoke Reviewer" &&
        reviewerResolution.json.thread.resolution === "Occupancy group B was confirmed from the approved Project drawings." &&
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
    const reviewerReopen = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 5,
        status: "open"
      }
    });
    assert(
      reviewerReopen.response.ok &&
        reviewerReopen.json.thread.version === 6 &&
        reviewerReopen.json.thread.status === "open" &&
        reviewerReopen.json.thread.resolution === null &&
        reviewerReopen.json.activity.metadata.previousResolution ===
          "Occupancy group B was confirmed from the approved Project drawings.",
      "A reviewer could not reopen resolved coordination while preserving resolution history."
    );
    const reviewerReresolution = await request("/projects/collaboration/threads/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        threadID: reviewThreadID,
        expectedVersion: 6,
        status: "resolved",
        resolution: "The reopened request was reviewed and remains resolved."
      }
    });
    assert(
      reviewerReresolution.response.ok &&
        reviewerReresolution.json.thread.version === 7 &&
        reviewerReresolution.json.thread.resolution ===
          "The reopened request was reviewed and remains resolved.",
      "A reopened coordination thread could not be resolved again with a new statement."
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
    const coordinationAssigneeIDs = new Set(
      (collaborationSnapshot.json.project?.coordinationAssignees || [])
        .map((assignee) => assignee.userID)
    );
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
          artifact.payload.status === "resolved" &&
          artifact.payload.resolution === "The reopened request was reviewed and remains resolved."
        ) &&
        collaborationArtifacts.some((artifact) =>
          artifact.envelope.type === "reviewComment" &&
          artifact.payload.threadID === reviewThreadID &&
          artifact.payload.createdByDisplayName === "Smoke Editor"
        ) &&
        coordinationAssigneeIDs.has(sharedEditorID) &&
        coordinationAssigneeIDs.has(sharedReviewerID),
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
        ) &&
        Array.isArray(reportSources.json.warnings),
      "The Report Draft could not discover Project sources with a stable warning contract."
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
          item.evidence.length >= 1
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
    const reviewerReportHistory = await request("/reports/history/list", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0]
      }
    });
    const reviewerReportManifest = await request("/reports/manifests/get", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        manifestID: reportManifestID
      }
    });
    const reviewerReportPDF = await requestBinary("/reports/files/read", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        generatedReportID: webGeneratedReportID
      }
    });
    assert(
      reviewerReportHistory.response.ok &&
        reviewerReportHistory.json.reports.some((report) => report.id === reportManifestID) &&
        reviewerReportManifest.response.ok &&
        reviewerReportManifest.json.manifest.id === reportManifestID &&
        reviewerReportPDF.response.ok &&
        reviewerReportPDF.body.equals(storedWebPDF.body),
      "An authorized Project reviewer could not read organization-owned Report history, manifests, and files."
    );
    const reviewerReportDraftWrite = await request("/reports/drafts/save", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        title: "Unauthorized reviewer draft",
        reportDate,
        blocks: []
      }
    });
    assert(
      reviewerReportDraftWrite.response.status === 403 &&
        reviewerReportDraftWrite.json.code === "PROJECT_PERMISSION_REQUIRED",
      "A Project reviewer was allowed to mutate Report Drafts."
    );
    const editorReportDraft = await request("/reports/drafts/save", {
      method: "POST",
      token: sharedEditorToken,
      body: {
        auth: { accountUserID: sharedEditorID },
        projectID: researchProjectIDs[0],
        expectedVersion: 0,
        title: "Editor-owned shared Report Draft",
        reportDate,
        blocks: [{
          id: "editor-shared-heading",
          kind: "heading",
          text: "Shared Project coordination"
        }]
      }
    });
    const ownerDraftListAfterEditorWrite = await request("/reports/drafts/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      editorReportDraft.response.status === 201 &&
        editorReportDraft.json.draft.updatedBy === sharedEditorID &&
        ownerDraftListAfterEditorWrite.response.ok &&
        ownerDraftListAfterEditorWrite.json.drafts.some((draft) =>
          draft.id === editorReportDraft.json.draft.id
        ),
      "An authorized Project editor did not write its Report Draft into organization-owned Project storage."
    );
    const editorWorkboardPreviewUpload = await request("/workboards/previews/upload?" + new URLSearchParams({
      projectID: researchProjectIDs[0],
      workboardUpdatedAt: "2026-07-24T12:30:00.000Z",
      elementCount: "4"
    }), {
      method: "POST",
      token: sharedEditorToken,
      headers: {
        "content-type": "image/png",
        "x-permitext-user-id": sharedEditorID
      },
      rawBody: smokePNG
    });
    const ownerFoundationAfterEditorPreview = await request("/projects/foundation/state", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      editorWorkboardPreviewUpload.response.status === 201 &&
        ownerFoundationAfterEditorPreview.response.ok &&
        ownerFoundationAfterEditorPreview.json.workboardPreview.id ===
          editorWorkboardPreviewUpload.json.preview.id,
      "An authorized Project editor did not write the Workboard preview into organization-owned Project storage."
    );
    const reviewerWorkboardPreviewClear = await request("/workboards/previews/clear", {
      method: "POST",
      token: sharedReviewerToken,
      body: {
        auth: { accountUserID: sharedReviewerID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      reviewerWorkboardPreviewClear.response.status === 403 &&
        reviewerWorkboardPreviewClear.json.code === "PROJECT_PERMISSION_REQUIRED",
      "A Project reviewer was allowed to clear an organization-owned Workboard preview."
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
        moveResearchWithReview.json.conversation.projectContextReviewRequired === false &&
        moveResearchWithReview.json.conversation.projectContext.facts.length === 0,
      "Confirmed Research movement did not switch to the destination Project's current facts."
    );
    const continuedResearchAfterMove = await request("/research/conversations/message", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        conversationID,
        question: "Which current facts from the destination Project apply to this question?"
      }
    });
    assert(
      continuedResearchAfterMove.response.ok,
      "Research did not continue using the destination Project's visible current facts after a confirmed move."
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
        immutableAnswerAfterMove.json.answer.evidence.some((snapshot) =>
          snapshot.sectionID === "8881" &&
          snapshot.provenance?.userSelectedText === selectedResearchText
        ),
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
        /^[A-Z][a-z]{2} \d{1,2}, \d{4} · \d{1,2}:\d{2} [AP]M$/.test(
          reusedResearchEvidence.json.conversation.title
        ) &&
        reusedResearchEvidence.json.conversation.sources[0].id !==
          createdConversation.json.conversation.sources[0].id &&
        reusedResearchEvidence.json.conversation.sources[0].selectedText ===
          selectedResearchText &&
        !JSON.stringify(reusedResearchEvidence.json.conversation).includes("When must the owner notify the department?"),
      "Reusing approved evidence did not create a fresh Project-linked conversation with new evidence identities."
    );
    const viewerFirmDelete = await request("/organizations/delete", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        organizationID,
        confirmation: "delete"
      }
    });
    assert(
      viewerFirmDelete.response.status === 403 &&
        viewerFirmDelete.json.code === "ORGANIZATION_OWNER_REQUIRED",
      "A non-owner was allowed to delete a firm workspace."
    );
    const unconfirmedFirmDelete = await request("/organizations/delete", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID
      }
    });
    assert(
      unconfirmedFirmDelete.response.status === 400 &&
        unconfirmedFirmDelete.json.code === "ORGANIZATION_DELETE_CONFIRMATION_REQUIRED",
      "Firm workspace deletion did not require explicit confirmation."
    );
    const ownerFirmDelete = await request("/organizations/delete", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        organizationID,
        confirmation: "delete"
      }
    });
    assert(
      ownerFirmDelete.response.ok &&
        ownerFirmDelete.json.deleted === true &&
        ownerFirmDelete.json.restoredProjectIDs.includes(researchProjectIDs[0]),
      "The firm Owner could not delete the workspace and return its Project to personal ownership."
    );
    const organizationsAfterFirmDelete = await request("/organizations/list", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    const personalProjectAfterFirmDelete = await request("/projects/foundation/state", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        projectID: researchProjectIDs[0]
      }
    });
    const formerViewerAfterFirmDelete = await request("/organizations/projects/snapshot", {
      method: "POST",
      token: sharedViewerToken,
      body: {
        auth: { accountUserID: sharedViewerID },
        projectID: researchProjectIDs[0]
      }
    });
    assert(
      organizationsAfterFirmDelete.response.ok &&
        !organizationsAfterFirmDelete.json.organizations.some((item) => item.id === organizationID) &&
        personalProjectAfterFirmDelete.response.ok &&
        [403, 404].includes(formerViewerAfterFirmDelete.response.status),
      "Firm deletion did not remove shared access while preserving the Owner's personal Project."
    );
    const researchUsage = await request("/research/usage", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(
      researchUsage.response.ok &&
        researchUsage.json.usage.unlimited === true &&
        !("requestsUsed" in researchUsage.json.usage) &&
        !("requestLimit" in researchUsage.json.usage) &&
        !("resetDate" in researchUsage.json.usage) &&
        !("tokens" in researchUsage.json.usage) &&
        !("estimatedCostUSD" in researchUsage.json.usage) &&
        researchUsage.json.usage.evidenceDiscoveryEnabled === true,
      "The public Pro Research contract exposed an internal quota or spend metric."
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
        JSON.stringify(immutableAnswerAfterEvidenceChange.json.answer.evidence) ===
          JSON.stringify(immutableAnswerRead.json.answer.evidence),
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
    const adminConsole = await request("/admin/");
    assert(
      adminConsole.response.ok && adminConsole.text.includes("Permitext Console"),
      "The canonical owner console route did not load."
    );
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
        internalData.json.retrievalDataset.cases.length > 0 &&
        internalData.json.zoningDataset.cases.length > 0 &&
        internalData.json.zoningReviewCases.every((testCase) =>
          testCase.selectedEvidence.length === testCase.selectedEvidenceSectionIDs.length
        ) &&
        internalData.json.feedbackCandidates.some((item) => item.answerID === answerID) &&
        internalData.json.feedbackRecords.some((item) =>
          item.answerID === answerID &&
          item.triageStatus === "new" &&
          item.professionalRole === "architect_designer"
        ) &&
        internalData.json.researchSpend?.totals?.estimatedCostUSD === 0 &&
        internalData.json.researchSpend?.internalMonthlyRequestGuardrail === 100 &&
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
    const approvedResearchCaseIDs = new Set(
      internalData.json.dataset.cases
        .filter((testCase) => testCase.status === "approved")
        .map((testCase) => testCase.id)
    );
    const unapprovedRetrievalCase = internalData.json.retrievalDataset.cases.find(
      (testCase) => !approvedResearchCaseIDs.has(testCase.sourceResearchCaseID)
    );
    assert(unapprovedRetrievalCase, "Smoke retrieval approval guard needs a linked draft Research case.");
    const prematureRetrievalApproval = await request("/internal/evaluations/review", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        kind: "retrieval-case",
        caseID: unapprovedRetrievalCase.id,
        decision: "approved",
        reviewer: "Smoke retrieval reviewer",
        notes: "This must remain blocked while its Research evidence case is a draft."
      }
    });
    assert(
      prematureRetrievalApproval.response.status === 409,
      "A retrieval scenario was approved before its linked Research evidence case."
    );
    const retrievalCaseID = internalData.json.retrievalDataset.cases[0].id;
    const revisedRetrievalCase = await request("/internal/evaluations/review", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        kind: "retrieval-case",
        caseID: retrievalCaseID,
        decision: "revise",
        reviewer: "Smoke retrieval reviewer",
        notes: "Revise the candidate expectation."
      }
    });
    assert(revisedRetrievalCase.response.ok, "The retrieval review queue did not accept a revise decision.");
    const zoningCaseID = internalData.json.zoningDataset.cases[0].id;
    const rejectedZoningCase = await request("/internal/evaluations/review", {
      method: "POST",
      token: signIn.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: userID },
        kind: "zoning-case",
        caseID: zoningCaseID,
        decision: "rejected",
        reviewer: "Smoke zoning reviewer",
        notes: "Reject the draft case."
      }
    });
    assert(rejectedZoningCase.response.ok, "The Zoning review queue did not accept a reject decision.");
    const savedRetrievalDataset = JSON.parse(
      await readFile(join(evaluationRoot, "evidence-retrieval-cases.json"), "utf8")
    );
    const savedZoningDataset = JSON.parse(
      await readFile(join(evaluationRoot, "zoning-cases.json"), "utf8")
    );
    assert(
      savedRetrievalDataset.cases.find((testCase) => testCase.id === retrievalCaseID).status === "draft" &&
        savedRetrievalDataset.cases.find((testCase) => testCase.id === retrievalCaseID).reviewer === "Smoke retrieval reviewer" &&
        savedZoningDataset.cases.find((testCase) => testCase.id === zoningCaseID).status === "rejected" &&
        savedZoningDataset.cases.find((testCase) => testCase.id === zoningCaseID).reviewer === "Smoke zoning reviewer",
      "Supplemental review decisions were not persisted with explicit reviewer metadata."
    );
    const reviewsAfterCaseDecision = JSON.parse(
      await readFile(join(evaluationRoot, "reviews.json"), "utf8")
    ).reviews;
    assert(
      reviewsAfterCaseDecision.filter((review) => review.kind === "run").length === 1 &&
        reviewsAfterCaseDecision.filter((review) => review.kind === "case").length === 1 &&
        reviewsAfterCaseDecision.filter((review) => review.kind === "retrieval-case").length === 1 &&
        reviewsAfterCaseDecision.filter((review) => review.kind === "zoning-case").length === 1,
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
    const currentSmokeUserToken = profileAfterAttach.json.account.backendSessionToken;

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
      token: webAppleSignIn.json.account.backendSessionToken,
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
      token: webAppleSignIn.json.account.backendSessionToken,
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
      token: webAppleSignIn.json.account.backendSessionToken,
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

    const unpaidStripeCheckoutEvent = JSON.stringify({
      id: "evt_smoke_checkout_unpaid",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "cs_smoke_unpaid",
          mode: "subscription",
          payment_status: "unpaid",
          client_reference_id: "apple:second-smoke-user",
          customer: "cus_smoke",
          subscription: "sub_smoke_unpaid",
          metadata: { accountUserID: "apple:second-smoke-user" }
        }
      }
    });
    const unpaidStripeCheckoutWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": stripeSignature(unpaidStripeCheckoutEvent, stripeWebhookSecret)
      },
      rawBody: unpaidStripeCheckoutEvent
    });
    assert(
      unpaidStripeCheckoutWebhook.response.ok && unpaidStripeCheckoutWebhook.json.changed === false,
      "Stripe checkout granted access before payment completed."
    );

    const stripeCheckoutEvent = JSON.stringify({
      id: "evt_smoke_checkout",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "cs_smoke",
          mode: "subscription",
          client_reference_id: "apple:second-smoke-user",
          customer: "cus_smoke",
          subscription: "sub_smoke",
          payment_status: "paid",
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
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        publicUsername: "wrong-token-profile"
      }
    });
    assert(crossAccountProfile.response.status === 401, "Profile update allowed another account's session token.");

    const crossAccountPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: "apple:second-smoke-user" } }
    });
    assert(crossAccountPull.response.status === 401, "Pull allowed another account's session token.");

    const duplicateProfile = await request("/account/profile", {
      method: "POST",
      token: secondSignInAfterStripeDelete.json.account.backendSessionToken,
      body: {
        auth: { accountUserID: "apple:second-smoke-user" },
        publicUsername: "smoke-pro"
      }
    });
    assert(duplicateProfile.response.status === 409, "Profile update allowed a duplicate public username.");

    const invalidProfile = await request("/account/profile", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{ unknown: { id: "bad", userID, updatedAt: "2026-06-04T00:00:00Z" } }]
        }
      }
    });
    assert(malformedPush.response.status === 400, "Push accepted an unsupported mutation kind.");

    for (const invalidID of [{}, [], 123, "x".repeat(513)]) {
      const invalidRecordIDPush = await request("/sync/push", {
        method: "POST",
        token: currentSmokeUserToken,
        body: {
          auth: { accountUserID: userID },
          batch: {
            user: { id: userID },
            mutations: [{
              savedItem: {
                id: invalidID,
                userID,
                codeVersion: defaultSyncCodeVersion,
                sectionID: 1,
                updatedAt: "2026-06-04T00:00:00Z"
              }
            }]
          }
        }
      });
      assert(
        invalidRecordIDPush.response.status === 400,
        `Push accepted malformed record ID ${JSON.stringify(invalidID)}.`
      );
    }

    const futureDatedPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [{
            savedItem: {
              id: `${userID}:saved:future-pinned`,
              userID,
              codeVersion: defaultSyncCodeVersion,
              sectionID: 1,
              updatedAt: "9999-12-31T23:59:59.000Z"
            }
          }]
        }
      }
    });
    assert(futureDatedPush.response.status === 400, "Push accepted a record timestamp that can pin future updates.");

    const oversizedPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: Array.from({ length: 101 }, () => ({})) }
      }
    });
    assert(oversizedPush.response.status === 413, "Push accepted an oversized mutation batch.");

    const mismatchedUserPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
    assert(pull.json.entitlementFingerprint, "Full pull omitted its entitlement checkpoint fingerprint.");

    const unchangedCheckpoint = await request("/sync/checkpoint", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        sinceEventID: pull.json.latestEventID,
        contentMapVersion: pull.json.contentMapVersion,
        entitlementFingerprint: pull.json.entitlementFingerprint
      }
    });
    assert(unchangedCheckpoint.response.ok, "Unchanged sync checkpoint failed.");
    assert(unchangedCheckpoint.json.changed === false, "An unchanged checkpoint requested a full pull.");

    const checkpointMutation = {
      annotation: {
        id: `${userID}:annotation:${defaultSyncCodeVersion}:900001`,
        userID,
        codeVersion: defaultSyncCodeVersion,
        sectionID: 900001,
        noteBody: "Checkpoint mutation",
        tags: [],
        updatedAt: "2026-06-04T00:05:00Z"
      }
    };
    const checkpointPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: [checkpointMutation] }
      }
    });
    assert(checkpointPush.response.ok, "Checkpoint setup mutation failed.");

    const changedCheckpoint = await request("/sync/checkpoint", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        sinceEventID: pull.json.latestEventID,
        contentMapVersion: pull.json.contentMapVersion,
        entitlementFingerprint: pull.json.entitlementFingerprint
      }
    });
    assert(changedCheckpoint.response.ok, "Changed sync checkpoint failed.");
    assert(changedCheckpoint.json.changed === true, "A remote-device event did not invalidate the checkpoint.");
    assert(
      changedCheckpoint.json.latestEventID > pull.json.latestEventID,
      "Checkpoint did not expose the newer sync event."
    );

    const invalidInlineWorkboardPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID } }
    });
    const pulledWorkboard = workboardPull.json.mutations.find((item) =>
      item.workboard?.id === canonicalWorkboardRecordID
    )?.workboard;
    assert(pulledWorkboard?.elements?.[0]?.id === "rectangle-smoke", "Workboard pull omitted drawing elements.");
    assert(!Object.values(pulledWorkboard.files || {}).some((file) => file.dataURL), "Workboard pull exposed inline image data.");

    const workboardExcludedPull = await request("/sync/pull", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        excludedMutationKinds: ["workboard", "not-a-real-kind"]
      }
    });
    assert(workboardExcludedPull.response.ok, "Pull with excludedMutationKinds failed.");
    assert(
      !workboardExcludedPull.json.mutations.some((item) => item.workboard),
      "Pull with excludedMutationKinds still returned workboard mutations."
    );
    assert(
      workboardExcludedPull.json.mutations.some((item) => item.savedItem || item.annotation || item.project),
      "Pull with excludedMutationKinds dropped non-workboard mutations."
    );

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
      token: currentSmokeUserToken,
      headers: {
        "content-type": "image/png",
        "x-permitext-user-id": userID
      },
      rawBody: Buffer.from([0x89, 0x50, 0x4e, 0x47])
    });
    assert(unconfiguredAssetUpload.response.status === 503, "Workboard asset upload did not report missing private Blob storage.");

    const forgedAssetDelete = await request("/workboards/assets/delete", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID } }
    });
    assert(webAfterIOSDeletePull.response.ok, "Web pull after iOS delete failed.");
    const deletedSavedRecord = webAfterIOSDeletePull.json.mutations.find((item) =>
      item.savedItem?.id === canonicalSavedRecordID
    )?.savedItem;
    assert(deletedSavedRecord?.deletedAt, "Web pull did not receive the iOS delete tombstone.");

    const iosRestorePush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID } }
    });
    const webDeletedSavedRecord = iosAfterWebDeletePull.json.mutations.find((item) =>
      item.savedItem?.id === canonicalSavedRecordID
    )?.savedItem;
    assert(webDeletedSavedRecord?.deletedAt, "iOS pull did not receive the web delete tombstone.");

    const legacyWebAnnotationPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
        blockID: "paragraph-smoke",
        scope: "manual",
        updatedAt: "2026-06-06T00:00:00Z"
      }
    };
    const projectRecordID = `${userID}:project:${defaultSyncCodeVersion}:project-client-smoke`;
    const projectSectionRecordID = `${userID}:project-section:${defaultSyncCodeVersion}:project-client-smoke:900001:paragraph-smoke:manual`;
    const projectPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
    const projectHubBootstrap = await request("/projects/hub/bootstrap", {
      method: "POST",
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID }, projectID: "project-client-smoke" }
    });
    assert(projectHubBootstrap.response.ok, "Project Hub bootstrap failed.");
    assert(
      projectHubBootstrap.json.projectID === "project-client-smoke" &&
        Array.isArray(projectHubBootstrap.json.foundation?.projects) &&
        projectHubBootstrap.json.foundation.projects.length === 1 &&
        projectHubBootstrap.json.foundation.projects[0].id === "project-client-smoke" &&
        Array.isArray(projectHubBootstrap.json.notebook?.cards) &&
        Array.isArray(projectHubBootstrap.json.reports?.reports),
      "Project Hub bootstrap did not return a single-project foundation with notebook and report sections."
    );
    const linkSavedToProject = await request("/projects/foundation/link", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
    const archiveNotebookCard = await request("/notebook/cards/archive", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        cardID: notebookCardID,
        expectedVersion: 2,
        archived: true
      }
    });
    assert(
      archiveNotebookCard.response.ok &&
        archiveNotebookCard.json.card.version === 3 &&
        archiveNotebookCard.json.card.archivedAt &&
        archiveNotebookCard.json.activity.action === "notebook-card.archived",
      "Archiving a Notebook card did not preserve it as an archived Project note."
    );
    const restoreNotebookCard = await request("/notebook/cards/archive", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        cardID: notebookCardID,
        expectedVersion: 3,
        archived: false
      }
    });
    assert(
      restoreNotebookCard.response.ok &&
        restoreNotebookCard.json.card.version === 4 &&
        !restoreNotebookCard.json.card.archivedAt &&
        restoreNotebookCard.json.activity.action === "notebook-card.restored",
      "Restoring an archived Notebook card failed."
    );
    const deleteNotebookCard = await request("/notebook/cards/delete", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        projectID: "project-client-smoke",
        cardID: notebookCardID,
        expectedVersion: 4
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
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID }, projectID: "project-client-smoke" }
    });
    assert(
      notebookListAfterDelete.response.ok && notebookListAfterDelete.json.cards.length === 0,
      "A deleted Notebook card remained in the active Project card list."
    );
    const pullAfterFoundationUnlink = await request("/sync/pull", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID } }
    });
    const archivedProject = projectArchivePull.json.mutations.find((mutation) =>
      mutation.project?.id === projectRecordID
    )?.project;
    assert(archivedProject?.archivedAt === archivedAt, "Project archive state did not survive sync.");

    const projectRestorePush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID } }
    });
    const restoredProject = projectRestorePull.json.mutations.find((mutation) =>
      mutation.project?.id === projectRecordID
    )?.project;
    assert(restoredProject && restoredProject.archivedAt === null, "Project restore state did not survive sync.");
    const projectActivityAfterRestore = await request("/projects/foundation/state", {
      method: "POST",
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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
      token: currentSmokeUserToken,
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

    const continuityHistoryMutation = (updatedAt, sectionID, viewedAt, query) => ({
      continuity: {
        userID,
        codeVersion: "nyc-2022",
        values: {
          recentlyViewedSectionsJSON: JSON.stringify([{
            sectionID,
            sectionNumber: String(sectionID),
            title: `Continuity smoke ${sectionID}`,
            chapterTitle: "Continuity smoke",
            codeSectionID: 1,
            codeSectionName: "Building Code",
            previewText: "",
            viewedAt
          }]),
          recentSearchesJSON: JSON.stringify([query])
        },
        updatedAt
      }
    });
    const concurrentContinuityPushes = await Promise.all([
      continuityHistoryMutation("2026-06-07T23:59:58Z", 910001, 802_000_001, "egress"),
      continuityHistoryMutation("2026-06-07T23:59:59Z", 910002, 802_000_002, "occupancy")
    ].map((mutation) => request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        batch: { user: { id: userID }, mutations: [mutation] }
      }
    })));
    assert(
      concurrentContinuityPushes.every(({ response, json }) =>
        response.ok &&
        json.acceptedMutationIDs.includes(`${userID}:continuity:${defaultSyncCodeVersion}`)
      ),
      "Concurrent file-backed continuity snapshots did not merge."
    );
    const staleContinuityPush = await request("/sync/push", {
      method: "POST",
      token: currentSmokeUserToken,
      body: {
        auth: { accountUserID: userID },
        batch: {
          user: { id: userID },
          mutations: [
            continuityHistoryMutation("2026-06-07T23:59:57Z", 910003, 802_000_000, "sprinklers")
          ]
        }
      }
    });
    assert(
      staleContinuityPush.response.ok &&
      staleContinuityPush.json.acceptedMutationIDs.includes(`${userID}:continuity:${defaultSyncCodeVersion}`),
      "An out-of-order file-backed continuity snapshot was rejected instead of merged."
    );
    const convergedContinuityPull = await request("/sync/pull", {
      method: "POST",
      token: currentSmokeUserToken,
      body: { auth: { accountUserID: userID } }
    });
    const convergedContinuity = convergedContinuityPull.json.mutations
      .map((mutation) => mutation.continuity)
      .find(Boolean);
    const convergedViews = JSON.parse(convergedContinuity.values.recentlyViewedSectionsJSON);
    const convergedSearches = JSON.parse(convergedContinuity.values.recentSearchesJSON);
    assert(
      [910001, 910002, 910003].every((sectionID) =>
        convergedViews.some((entry) => entry.sectionID === sectionID)
      ),
      "File-backed continuity lost a recent view from another device."
    );
    assert(
      ["egress", "occupancy", "sprinklers"].every((query) => convergedSearches.includes(query)),
      "File-backed continuity lost a recent search from another device."
    );
    assert(
      convergedContinuity.values.activeProjectID === "42",
      "Merging stale histories replaced newer snapshot-owned continuity fields."
    );

    const projectDependencyPull = await request("/sync/pull", {
      method: "POST",
      token: currentSmokeUserToken,
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

    const deletionSignIn = await request("/account/sign-in", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.40" },
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-account-deletion",
          displayName: "Account Deletion Smoke User"
        }
      }
    });
    assert(deletionSignIn.response.ok, "Account-deletion smoke sign-in failed.");
    const deletionUserID = deletionSignIn.json.account.appUserID;
    const deletionToken = deletionSignIn.json.account.backendSessionToken;
    const deletionPush = await request("/sync/push", {
      method: "POST",
      token: deletionToken,
      body: {
        auth: { accountUserID: deletionUserID },
        batch: {
          user: { id: deletionUserID },
          mutations: [{
            savedItem: {
              id: "saved-for-account-deletion",
              userID: deletionUserID,
              codeVersion: "2022 Construction Codes",
              sectionID: 900002,
              createdAt: "2026-07-25T00:00:00Z",
              updatedAt: "2026-07-25T00:00:00Z"
            }
          }]
        }
      }
    });
    assert(deletionPush.response.ok, "Account-deletion fixture push failed.");
    const unconfirmedDeletion = await request("/account/delete", {
      method: "DELETE",
      token: deletionToken,
      body: {
        auth: { accountUserID: deletionUserID },
        confirmation: "delete"
      }
    });
    assert(unconfirmedDeletion.response.status === 400, "Account deletion accepted an ambiguous confirmation.");
    const accountDeletion = await request("/account/delete", {
      method: "DELETE",
      token: deletionToken,
      body: {
        auth: { accountUserID: deletionUserID },
        confirmation: "DELETE"
      }
    });
    assert(accountDeletion.response.ok && accountDeletion.json.deleted === true, "Account deletion failed.");
    const pullAfterAccountDeletion = await request("/sync/pull", {
      method: "POST",
      token: deletionToken,
      body: { auth: { accountUserID: deletionUserID } }
    });
    assert(pullAfterAccountDeletion.response.status === 401, "A deleted account session remained usable.");
    const delayedStripeEvent = JSON.stringify({
      id: "evt_after_account_deletion",
      type: "customer.subscription.updated",
      livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "sub_after_account_deletion",
          status: "active",
          customer: "cus_after_account_deletion",
          metadata: {
            accountUserID: deletionUserID,
            permitextPackage: "pro"
          }
        }
      }
    });
    const delayedStripeWebhook = await request("/billing/stripe/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": stripeSignature(delayedStripeEvent, stripeWebhookSecret)
      },
      rawBody: delayedStripeEvent
    });
    assert(
      delayedStripeWebhook.response.ok && delayedStripeWebhook.json.changed === false,
      "A delayed Stripe webhook restored billing access after account deletion."
    );
    const deletionRecreate = await request("/account/sign-in", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.40" },
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-account-deletion",
          displayName: "Recreated Account Deletion Smoke User"
        }
      }
    });
    assert(deletionRecreate.response.ok, "Deleted account could not be recreated through Sign in with Apple.");
    assert(
      !deletionRecreate.json.entitlement,
      "A recreated deleted account inherited a stale billing entitlement."
    );
    const deletionRecreatePull = await request("/sync/pull", {
      method: "POST",
      token: deletionRecreate.json.account.backendSessionToken,
      body: { auth: { accountUserID: deletionRecreate.json.account.appUserID } }
    });
    assert(
      deletionRecreatePull.response.ok && deletionRecreatePull.json.mutations.length === 0,
      "Deleted synced content reappeared when the account identity was recreated."
    );

    const oversizedBody = await request("/account/profile", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.20"
      },
      rawBody: JSON.stringify({ padding: "x".repeat(1024 * 1024) })
    });
    assert(oversizedBody.response.status === 413, "Oversized request body was not rejected.");

    const accountLimitSignIn = await request("/account/sign-in", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.41" },
      body: {
        credential: {
          provider: "apple",
          providerUserID: "smoke-account-rate-limit",
          displayName: "Account Rate Limit Smoke User"
        }
      }
    });
    assert(accountLimitSignIn.response.ok, "Account rate-limit fixture sign-in failed.");
    const accountLimitUserID = accountLimitSignIn.json.account.appUserID;
    const accountLimitToken = accountLimitSignIn.json.account.backendSessionToken;
    const accountLimitResults = await Promise.all(
      Array.from({ length: 31 }, (_, index) =>
        request("/billing/apple/transactions/verify", {
          method: "POST",
          token: accountLimitToken,
          headers: { "x-forwarded-for": `203.0.113.${100 + index}, 10.0.0.9` },
          body: {
            auth: { accountUserID: accountLimitUserID },
            signedTransactionInfo: "not-a-signed-transaction"
          }
        })
      )
    );
    assert(
      accountLimitResults.filter((result) => result.response.status === 422).length === 30 &&
        accountLimitResults.filter((result) => result.response.status === 429).length === 1,
      "Verified account rate limiting did not aggregate concurrent requests across forwarded client addresses."
    );

    const adminLimitResults = await Promise.all(
      Array.from({ length: 31 }, () =>
        request("/admin/accounts/restore-checklist", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.42, 10.0.0.9" },
          body: { userID }
        })
      )
    );
    assert(
      adminLimitResults.filter((result) => result.response.status === 401).length === 30 &&
        adminLimitResults.filter((result) => result.response.status === 429).length === 1,
      "Concurrent forwarded-IP requests did not enforce the exact administrator route allowance."
    );
    const differentForwardedClient = await request("/admin/accounts/restore-checklist", {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.43, 10.0.0.9" },
      body: { userID }
    });
    assert(
      differentForwardedClient.response.status === 401,
      "The limiter used a proxy hop instead of the first trusted forwarded client address."
    );

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
