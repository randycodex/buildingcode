import { randomUUID } from "node:crypto";

export const firmControlsSchemaVersion = 1;

export const permitextRequiredReportDisclaimers = Object.freeze([
  "Permitext is an unofficial reference tool. Verify legal, permitting, design, and construction decisions against enacted code text and agency guidance.",
  "AI-assisted Research is limited to the approved evidence recorded in this report and may require additional Project facts or professional review."
]);

const statusValues = new Set(["active", "archived"]);
const researchAllowanceModes = new Set(["pooled", "per-seat"]);

function requiredText(value, field, maximum = 512) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum) throw new Error(`Invalid ${field}.`);
  return normalized;
}

function optionalText(value, field, maximum = 512) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) throw new Error(`Invalid ${field}.`);
  return normalized || null;
}

function requiredISO(value, field) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ${field}.`);
  return new Date(timestamp).toISOString();
}

function positiveInteger(value, field, maximum) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > maximum) {
    throw new Error(`Invalid ${field}.`);
  }
  return normalized;
}

function normalizedStatus(value, field) {
  const normalized = requiredText(value || "active", field, 32).toLowerCase();
  if (!statusValues.has(normalized)) throw new Error(`Invalid ${field}.`);
  return normalized;
}

function normalizedHex(value, fallback = "#a65318") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (!/^#[0-9a-f]{6}$/.test(normalized)) {
    throw new Error("Invalid firm color.");
  }
  return normalized;
}

function normalizedTextList(values, field, options = {}) {
  const maximumItems = options.maximumItems || 20;
  const maximumLength = options.maximumLength || 5_000;
  const normalized = (Array.isArray(values) ? values : [])
    .map((value) => requiredText(value, field, maximumLength));
  if (normalized.length > maximumItems) throw new Error(`Too many ${field} entries.`);
  return Array.from(new Set(normalized));
}

function normalizedTag(tag, index, now) {
  return {
    id: requiredText(tag?.id || randomUUID(), "firm tag ID", 256),
    name: requiredText(tag?.name, "firm tag name", 80),
    colorHex: normalizedHex(tag?.colorHex, "#6b7280"),
    status: normalizedStatus(tag?.status, "firm tag status"),
    createdAt: requiredISO(tag?.createdAt || now, "firm tag creation date"),
    updatedAt: requiredISO(tag?.updatedAt || now, "firm tag update date"),
    order: Number.isSafeInteger(Number(tag?.order)) ? Number(tag.order) : index
  };
}

function normalizedTemplate(template, index, now) {
  return {
    id: requiredText(template?.id || randomUUID(), "Report template ID", 256),
    name: requiredText(template?.name, "Report template name", 120),
    description: optionalText(template?.description, "Report template description", 1_000),
    coverLabel: requiredText(
      template?.coverLabel || "Permitext Project Report",
      "Report template cover label",
      160
    ),
    disclaimers: normalizedTextList(template?.disclaimers, "Report template disclaimer"),
    status: normalizedStatus(template?.status, "Report template status"),
    createdAt: requiredISO(template?.createdAt || now, "Report template creation date"),
    updatedAt: requiredISO(template?.updatedAt || now, "Report template update date"),
    order: Number.isSafeInteger(Number(template?.order)) ? Number(template.order) : index
  };
}

function normalizedHistoryEntry(entry) {
  return {
    version: positiveInteger(entry?.version, "firm controls history version", 1_000_000),
    actorUserID: requiredText(entry?.actorUserID, "firm controls history actor", 256),
    summary: requiredText(entry?.summary, "firm controls history summary", 500),
    createdAt: requiredISO(entry?.createdAt, "firm controls history date")
  };
}

export function defaultFirmControls({
  organizationName,
  ownerUserID,
  createdAt = new Date().toISOString()
}) {
  const now = requiredISO(createdAt, "firm controls creation date");
  return {
    schemaVersion: firmControlsSchemaVersion,
    version: 1,
    tags: [],
    projectTagAssignments: {},
    reportTemplates: [{
      id: "permitext-standard",
      name: "Permitext Standard",
      description: "Permitext's professional-use report presentation.",
      coverLabel: "Permitext Project Report",
      disclaimers: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
      order: 0
    }],
    defaultReportTemplateID: "permitext-standard",
    branding: {
      displayName: requiredText(organizationName, "firm branding name", 160),
      accentColorHex: "#a65318",
      website: null,
      footerText: null
    },
    requiredDisclaimers: [],
    researchAllowance: {
      mode: "pooled",
      monthlyUnits: 100,
      resetDayUTC: 1,
      authority: "policy-only"
    },
    retentionPolicy: {
      retentionDays: 2_555,
      enforcement: "policy-only",
      automaticDeletionEnabled: false
    },
    administrativeHistory: [],
    updatedAt: now,
    updatedByUserID: requiredText(ownerUserID, "firm controls owner", 256)
  };
}

export function normalizeFirmControls(
  value,
  {
    organizationName,
    ownerUserID,
    createdAt = new Date().toISOString(),
    updatedAt = createdAt,
    updatedByUserID = ownerUserID,
    version = null,
    historyEntry = null
  }
) {
  const defaults = defaultFirmControls({ organizationName, ownerUserID, createdAt });
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : defaults;
  const now = requiredISO(updatedAt, "firm controls update date");
  const tags = (Array.isArray(source.tags) ? source.tags : [])
    .map((tag, index) => normalizedTag(tag, index, now));
  if (tags.length > 64) throw new Error("Firm workspaces are limited to 64 tags.");
  if (new Set(tags.map((tag) => tag.id)).size !== tags.length) {
    throw new Error("Firm tag IDs must be unique.");
  }

  const reportTemplates = (Array.isArray(source.reportTemplates) && source.reportTemplates.length
    ? source.reportTemplates
    : defaults.reportTemplates)
    .map((template, index) => normalizedTemplate(template, index, now));
  if (reportTemplates.length > 32) throw new Error("Firm workspaces are limited to 32 Report templates.");
  if (new Set(reportTemplates.map((template) => template.id)).size !== reportTemplates.length) {
    throw new Error("Report template IDs must be unique.");
  }

  const tagIDs = new Set(tags.map((tag) => tag.id));
  const assignments = {};
  const sourceAssignments = source.projectTagAssignments &&
    typeof source.projectTagAssignments === "object" &&
    !Array.isArray(source.projectTagAssignments)
    ? source.projectTagAssignments
    : {};
  for (const [projectID, assignedTagIDs] of Object.entries(sourceAssignments)) {
    const normalizedProjectID = requiredText(projectID, "firm tag Project ID", 256);
    const normalizedAssignedIDs = Array.from(new Set(
      (Array.isArray(assignedTagIDs) ? assignedTagIDs : [])
        .map((tagID) => requiredText(tagID, "assigned firm tag ID", 256))
    ));
    if (normalizedAssignedIDs.some((tagID) => !tagIDs.has(tagID))) {
      throw new Error("A Project tag assignment references an unknown firm tag.");
    }
    if (normalizedAssignedIDs.length) assignments[normalizedProjectID] = normalizedAssignedIDs;
  }
  if (Object.keys(assignments).length > 500) {
    throw new Error("Firm tag assignments are limited to 500 Projects.");
  }

  const defaultReportTemplateID = requiredText(
    source.defaultReportTemplateID || reportTemplates[0].id,
    "default Report template ID",
    256
  );
  const defaultTemplate = reportTemplates.find((template) => template.id === defaultReportTemplateID);
  if (!defaultTemplate || defaultTemplate.status !== "active") {
    throw new Error("The default Report template must be active.");
  }

  const allowanceMode = requiredText(
    source.researchAllowance?.mode || defaults.researchAllowance.mode,
    "Research allowance mode",
    32
  ).toLowerCase();
  if (!researchAllowanceModes.has(allowanceMode)) {
    throw new Error("Invalid Research allowance mode.");
  }

  const priorHistory = (Array.isArray(source.administrativeHistory)
    ? source.administrativeHistory
    : [])
    .slice(-49)
    .map(normalizedHistoryEntry);
  const nextVersion = positiveInteger(
    version ?? source.version ?? defaults.version,
    "firm controls version",
    1_000_000
  );
  const administrativeHistory = historyEntry
    ? [...priorHistory, normalizedHistoryEntry({
        ...historyEntry,
        version: nextVersion,
        actorUserID: updatedByUserID,
        createdAt: now
      })].slice(-50)
    : priorHistory;

  return {
    schemaVersion: firmControlsSchemaVersion,
    version: nextVersion,
    tags,
    projectTagAssignments: assignments,
    reportTemplates,
    defaultReportTemplateID,
    branding: {
      displayName: requiredText(
        source.branding?.displayName || organizationName,
        "firm branding name",
        160
      ),
      accentColorHex: normalizedHex(source.branding?.accentColorHex),
      website: optionalText(source.branding?.website, "firm website", 500),
      footerText: optionalText(source.branding?.footerText, "firm report footer", 500)
    },
    requiredDisclaimers: normalizedTextList(source.requiredDisclaimers, "required firm disclaimer"),
    researchAllowance: {
      mode: allowanceMode,
      monthlyUnits: positiveInteger(
        source.researchAllowance?.monthlyUnits ?? defaults.researchAllowance.monthlyUnits,
        "monthly Research allowance",
        100_000
      ),
      resetDayUTC: positiveInteger(
        source.researchAllowance?.resetDayUTC ?? defaults.researchAllowance.resetDayUTC,
        "Research allowance reset day",
        28
      ),
      authority: "policy-only"
    },
    retentionPolicy: {
      retentionDays: positiveInteger(
        source.retentionPolicy?.retentionDays ?? defaults.retentionPolicy.retentionDays,
        "retention period",
        36_500
      ),
      enforcement: "policy-only",
      automaticDeletionEnabled: false
    },
    administrativeHistory,
    updatedAt: now,
    updatedByUserID: requiredText(updatedByUserID, "firm controls editor", 256)
  };
}

export function activeReportTemplate(controls, requestedTemplateID = null) {
  const templateID = String(
    requestedTemplateID || controls?.defaultReportTemplateID || ""
  ).trim();
  const template = (Array.isArray(controls?.reportTemplates) ? controls.reportTemplates : [])
    .find((candidate) => candidate.id === templateID && candidate.status === "active");
  if (!template) throw new Error("The selected Report template is unavailable.");
  return structuredClone(template);
}

export function reportPresentationSnapshot({ organization, controls, template }) {
  return {
    firmControlsVersion: positiveInteger(
      controls?.version,
      "Report firm controls version",
      1_000_000
    ),
    organization: organization ? {
      id: requiredText(organization.id, "Report organization ID", 256),
      name: requiredText(organization.name, "Report organization name", 160)
    } : null,
    template: {
      id: requiredText(template?.id, "Report template ID", 256),
      name: requiredText(template?.name, "Report template name", 120),
      coverLabel: requiredText(template?.coverLabel, "Report template cover label", 160)
    },
    branding: {
      displayName: requiredText(
        controls?.branding?.displayName || organization?.name,
        "Report branding name",
        160
      ),
      accentColorHex: normalizedHex(controls?.branding?.accentColorHex),
      website: optionalText(controls?.branding?.website, "Report branding website", 500),
      footerText: optionalText(controls?.branding?.footerText, "Report branding footer", 500)
    }
  };
}

export function reportDisclaimersForFirm({ controls, template }) {
  return Array.from(new Set([
    ...permitextRequiredReportDisclaimers,
    ...normalizedTextList(controls?.requiredDisclaimers, "required firm disclaimer"),
    ...normalizedTextList(template?.disclaimers, "Report template disclaimer")
  ]));
}
