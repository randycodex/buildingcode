import assert from "node:assert/strict";
import {
  activeReportTemplate,
  defaultFirmControls,
  normalizeFirmControls,
  permitextRequiredReportDisclaimers,
  reportDisclaimersForFirm,
  reportPresentationSnapshot
} from "../firm-controls-contract.mjs";

const createdAt = "2026-07-25T12:00:00.000Z";
const defaults = defaultFirmControls({
  organizationName: "Permit Studio PLLC",
  ownerUserID: "apple:owner",
  createdAt
});
assert.equal(defaults.version, 1);
assert.equal(defaults.retentionPolicy.automaticDeletionEnabled, false);
assert.equal(defaults.researchAllowance.authority, "policy-only");

const controls = normalizeFirmControls({
  ...defaults,
  tags: [{
    id: "tag-filing",
    name: "Filing",
    colorHex: "#A65318",
    createdAt,
    updatedAt: createdAt
  }],
  projectTagAssignments: {
    "project-1": ["tag-filing", "tag-filing"]
  },
  reportTemplates: [
    defaults.reportTemplates[0],
    {
      id: "template-client",
      name: "Client Report",
      coverLabel: "Client Code Report",
      disclaimers: ["Prepared for the named client only."],
      createdAt,
      updatedAt: createdAt
    }
  ],
  defaultReportTemplateID: "template-client",
  branding: {
    displayName: "Permit Studio",
    accentColorHex: "#1267A0",
    website: "https://example.test",
    footerText: "Permit Studio PLLC"
  },
  requiredDisclaimers: ["Professional judgment remains required."],
  researchAllowance: {
    mode: "per-seat",
    monthlyUnits: 75,
    resetDayUTC: 1
  },
  retentionPolicy: {
    retentionDays: 3_650,
    automaticDeletionEnabled: true
  }
}, {
  organizationName: "Permit Studio PLLC",
  ownerUserID: "apple:owner",
  createdAt,
  updatedAt: "2026-07-25T13:00:00.000Z",
  updatedByUserID: "apple:owner",
  version: 2,
  historyEntry: { summary: "Updated firm standards." }
});
assert.equal(controls.version, 2);
assert.equal(controls.branding.accentColorHex, "#1267a0");
assert.deepEqual(controls.projectTagAssignments["project-1"], ["tag-filing"]);
assert.equal(controls.retentionPolicy.automaticDeletionEnabled, false);
assert.equal(controls.retentionPolicy.enforcement, "policy-only");
assert.equal(controls.administrativeHistory[0].version, 2);

const template = activeReportTemplate(controls, "template-client");
assert.equal(template.coverLabel, "Client Code Report");
assert.deepEqual(reportDisclaimersForFirm({ controls, template }), [
  ...permitextRequiredReportDisclaimers,
  "Professional judgment remains required.",
  "Prepared for the named client only."
]);
const presentation = reportPresentationSnapshot({
  organization: { id: "organization-1", name: "Permit Studio PLLC" },
  controls,
  template
});
assert.equal(presentation.firmControlsVersion, 2);
assert.equal(presentation.branding.displayName, "Permit Studio");

assert.throws(() => normalizeFirmControls({
  ...defaults,
  defaultReportTemplateID: "missing-template"
}, {
  organizationName: "Permit Studio PLLC",
  ownerUserID: "apple:owner",
  createdAt
}), /default Report template/);
assert.throws(() => normalizeFirmControls({
  ...defaults,
  projectTagAssignments: { "project-1": ["missing-tag"] }
}, {
  organizationName: "Permit Studio PLLC",
  ownerUserID: "apple:owner",
  createdAt
}), /unknown firm tag/);
assert.throws(() => normalizeFirmControls({
  ...defaults,
  branding: {
    ...defaults.branding,
    accentColorHex: "orange"
  }
}, {
  organizationName: "Permit Studio PLLC",
  ownerUserID: "apple:owner",
  createdAt
}), /Invalid firm color/);

console.log("Permitext firm controls contract passed.");
